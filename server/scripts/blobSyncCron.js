/**
 * blobSyncCron.js
 *
 * Daily cron that recursively searches all folders/subfolders in Azure Blob
 * Storage for flight_data_df.parquet and weather_df.parquet, then upserts
 * new records into MongoDB — existing records are skipped.
 *
 * Schedule: 02:00 daily by default. Override with BLOB_SYNC_CRON env var.
 *
 * Run immediately:  node scripts/blobSyncCron.js --run-now
 * Run as scheduler: node scripts/blobSyncCron.js
 */

import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { BlobServiceClient } from '@azure/storage-blob';
import { ParquetReader } from '@dsnp/parquetjs';
import mongoose from 'mongoose';
import LogDetail from '../models/LogDetail.js';
import WeatherData from '../models/WeatherData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Config ────────────────────────────────────────────────────────────────

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME    = process.env.AZURE_BLOB_CONTAINER || 'wingcopter-data';
const CRON_SCHEDULE     = process.env.BLOB_SYNC_CRON       || '0 2 * * *';
const TEMP_DIR          = path.join(os.tmpdir(), 'wc-blob-sync');

// Target filenames to search for (case-insensitive)
const FLIGHT_DATA_FILE  = 'flight_data_df.parquet';
const WEATHER_DATA_FILE = 'weather_df.parquet';

// ─── Logging ───────────────────────────────────────────────────────────────

const log  = (m) => console.log(`[BlobSync] ${new Date().toISOString()}  ${m}`);
const warn = (m) => console.warn(`[BlobSync] ⚠️  ${m}`);
const err  = (m) => console.error(`[BlobSync] ❌  ${m}`);

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string' && v.includes(',')) return parseFloat(v.replace(',', '.'));
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// Convert all BigInt values in a row to Number so Mongoose doesn't choke
function sanitizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

function normalizeOperationType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('automatic'))                         return 'Automatic';
  if (s.includes('bvlos') || s.includes('blos'))      return 'BVLOS / BLOS';
  if (s.includes('vlos') && s.includes('manual'))     return 'VLOS (Manual)';
  if (s.includes('vlos') && s.includes('autonomous')) return 'VLOS Autonomous';
  if (s.includes('vlos') && s.includes('lts'))        return 'VLOS LTS';
  return 'Not Labelled';
}

// ─── Read parquet from local file ──────────────────────────────────────────

async function readParquet(filePath) {
  const reader = await ParquetReader.openFile(filePath);
  const cursor = reader.getCursor();
  const rows   = [];
  let record;
  while ((record = await cursor.next()) !== null) {
    rows.push(record);
  }
  await reader.close();
  return rows;
}

// ─── Download blob to temp file ────────────────────────────────────────────

async function downloadBlob(blobName) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  // Use a safe flat filename to avoid path conflicts
  const safeName = blobName.replace(/[\\/]/g, '__');
  const dest = path.join(TEMP_DIR, safeName);
  const client = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
  await client.getContainerClient(CONTAINER_NAME).getBlobClient(blobName).downloadToFile(dest);
  log(`Downloaded: ${blobName}`);
  return dest;
}

// ─── Upsert: LogDetail (flight_data_df.parquet) ────────────────────────────

async function upsertLogDetail(row) {
  row = sanitizeRow(row);
  const key = row.Key ?? row.key;
  if (!key) return false;
  if (await LogDetail.exists({ key })) return false;

  await new LogDetail({
    key,
    sn:                        row.SN        != null ? String(row.SN)        : undefined,
    date:                      row.Date      != null ? String(row.Date)      : undefined,
    total_time:                row.Total_time,
    flight_time:               row.Flight_time,
    filtered_flight_time:      row.filtered_flight_time,
    mc_time:                   row.MC_time,
    fw_time:                   row.FW_time,
    fc_version:                row.fc_version,
    cs_version:                row.cs_version,
    fwd_transitions:           row.fwd_transitions,
    bwd_transitions:           row.bwd_transitions,
    lte_loss:                  row.lte_loss,
    rth_loss:                  row.rth_loss,
    rth_logs:                  row.rth_logs,
    distance:                  row.distance,
    fwd_distance:              row.fwd_distance,
    bwd_distance:              row.bwd_distance,
    max_mc_xy_deviation:       row.max_mc_xy_deviation,
    max_mc_altitude_deviation: row.max_mc_altitude_deviation,
    max_fw_xy_deviation:       row.max_fw_xy_deviation,
    max_fw_altitude_deviation: row.max_fw_altitude_deviation,
    battery_0_sn:              row.battery_0_sn  != null ? String(row.battery_0_sn)  : undefined,
    battery_0_cycle:           row.battery_0_cycle,
    battery_0_max_temp:        row.battery_0_max_temp,
    battery_0_remaining:       row.battery_0_remaining,
    battery_1_sn:              row.battery_1_sn  != null ? String(row.battery_1_sn)  : undefined,
    battery_1_cycle:           row.battery_1_cycle,
    battery_1_max_temp:        row.battery_1_max_temp,
    battery_1_remaining:       row.battery_1_remaining,
    calculated_groundspeed:    row.calculated_groundspeed,
    last_usage:                row.last_usage != null ? String(row.last_usage) : undefined,
    flight:                    row.Flight ?? row.flight,
  }).save();
  return true;
}

// ─── Upsert: WeatherData (weather_df.parquet) ──────────────────────────────

async function upsertWeatherData(row) {
  row = sanitizeRow(row);
  const flightLog = row['Flight log(.ulg)'] ?? row.Key ?? row.key ?? row.KEY;
  const uaSN      = row['UA SN']            ?? row.uaSN ?? row.SN;
  if (!flightLog || !uaSN) return false;
  if (await WeatherData.exists({ flightLog })) return false;

  await new WeatherData({
    uaSN:              String(uaSN),
    flightLog,
    pressure:          parseNum(row['Pressure (hPa)']                     ?? row.pressure      ?? row.Pressure),
    humidity:          parseNum(row['Humidity (%)']                        ?? row.humidity      ?? row.Humidity),
    rain:              row['Rain - mm']                                    ?? row.rain          ?? row.Rain,
    temperature:       parseNum(row['Temperature (celsius)']               ?? row.temperature   ?? row.Temperature),
    location:          row.Location                                        ?? row.location      ?? row['Place Name'],
    amslMaxWind:       parseNum(row['Maximum Wind during the flight(m/s)'] ?? row.amslMaxWind),
    windRun:           parseNum(row['Wind before takeoff (m/s)']           ?? row.windRun       ?? row.wind),
    maxGust:           parseNum(row['Max Gust during the flight(m/s)']     ?? row.maxGust       ?? row['Max Gust']),
    gustBeforeTakeoff: parseNum(row['Gust before takeoff (m/s)']           ?? row.gustBeforeTakeoff),
    amsl:              parseNum(row['AMSL (m)']                            ?? row.amsl          ?? row.AMSL),
    cloud:             parseNum(row.cloud                                  ?? row.Cloud),
    windDirection:     row['Wind Direction (Before takeoff)']              ?? row.windDirection,
    takeoffTime:       row['Takeoff time[Local](DD/MM/YY HH:MM)']         ?? row.takeoffTime,
    landingTime:       row['Landing time[Local](DD/MM/YY HH:MM)']         ?? row.landingTime,
    dateTime:          row['Date & Time'] != null ? String(row['Date & Time']) : undefined,
    highTemp:          parseNum(row['High Temp - °C']                      ?? row.highTemp),
    lowWindChill:      parseNum(row.lowWindChill),
    thwIndex:          parseNum(row.thwIndex),
    wetBulb:           parseNum(row.wetBulb),
    windChill:         parseNum(row.windChill),
    operationType:     normalizeOperationType(row.operationType ?? row['Operation Type']),
  }).save();
  return true;
}

// ─── Process one parquet blob ──────────────────────────────────────────────

async function processBlob(blobName, type) {
  const localPath = await downloadBlob(blobName);

  let rows;
  try {
    rows = await readParquet(localPath);
  } finally {
    fs.rmSync(localPath, { force: true });
  }

  log(`  ${rows.length} rows in ${blobName} (type: ${type})`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    try {
      const added = type === 'flight'
        ? await upsertLogDetail(row)
        : await upsertWeatherData(row);
      added ? inserted++ : skipped++;
    } catch (e) {
      errors++;
      if (errors <= 3) err(`Row error in ${blobName}: ${e.message}`);
    }
  }

  log(`  ✅ inserted=${inserted}  skipped=${skipped}  errors=${errors}`);
  return { inserted, skipped, errors };
}

// ─── Main sync ─────────────────────────────────────────────────────────────

async function runSync() {
  log('─── Daily blob sync started ───');

  if (!CONNECTION_STRING) {
    err('AZURE_STORAGE_CONNECTION_STRING not set — aborting.');
    return;
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wingcopter');
    log('Connected to MongoDB');
  }

  const client    = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
  const container = client.getContainerClient(CONTAINER_NAME);

  // Recursively list ALL blobs (listBlobsFlat already walks all virtual folders)
  const found = { flight: [], weather: [] };

  log(`Listing blobs in container: ${CONTAINER_NAME}`);
  try {
    for await (const blob of container.listBlobsFlat()) {
      log(`  Found blob: ${blob.name}`);
      const basename = path.basename(blob.name).toLowerCase();
      if (basename === FLIGHT_DATA_FILE) {
        found.flight.push(blob.name);
      } else if (basename === WEATHER_DATA_FILE) {
        found.weather.push(blob.name);
      }
    }
  } catch (listErr) {
    err(`Failed to list blobs: ${listErr.message}`);
    err(`Details: ${JSON.stringify(listErr.details || listErr.code || '')}`);
    return;
  }

  log(`Found ${found.flight.length} flight_data_df.parquet file(s)`);
  log(`Found ${found.weather.length} weather_df.parquet file(s)`);

  const summary = [];

  for (const blobName of found.flight) {
    log(`Processing flight: ${blobName}`);
    try {
      const result = await processBlob(blobName, 'flight');
      summary.push({ blob: blobName, ...result });
    } catch (e) {
      err(`Failed "${blobName}": ${e.message}`);
      summary.push({ blob: blobName, error: e.message });
    }
  }

  for (const blobName of found.weather) {
    log(`Processing weather: ${blobName}`);
    try {
      const result = await processBlob(blobName, 'weather');
      summary.push({ blob: blobName, ...result });
    } catch (e) {
      err(`Failed "${blobName}": ${e.message}`);
      summary.push({ blob: blobName, error: e.message });
    }
  }

  // Clean up temp dir
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  log('─── Sync complete ───');
  summary.forEach(s =>
    s.error
      ? log(`  ${s.blob}: ERROR – ${s.error}`)
      : log(`  ${s.blob}: inserted=${s.inserted} skipped=${s.skipped} errors=${s.errors}`)
  );
}

// ─── Entry point ───────────────────────────────────────────────────────────

if (process.argv.includes('--run-now')) {
  runSync().then(() => process.exit(0)).catch(e => { err(e.message); process.exit(1); });
} else {
  log(`Cron scheduled: "${CRON_SCHEDULE}"`);
  cron.schedule(CRON_SCHEDULE, () =>
    runSync().catch(e => err(`Unhandled error: ${e.message}`))
  );
}
