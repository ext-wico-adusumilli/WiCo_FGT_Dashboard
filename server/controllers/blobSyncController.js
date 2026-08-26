import { BlobServiceClient } from '@azure/storage-blob';
import { ParquetReader } from '@dsnp/parquetjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import LogDetail from '../models/LogDetail.js';
import WeatherData from '../models/WeatherData.js';
import BlobSyncRun from '../models/BlobSyncRun.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR  = path.join(os.tmpdir(), 'wc-blob-sync');

const FLIGHT_FILE  = 'flight_data_df.parquet';
const WEATHER_FILE = 'weather_df.parquet';

// ── helpers (same as blobSyncCron) ─────────────────────────────────────────

function parseNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string' && v.includes(',')) return parseFloat(v.replace(',', '.'));
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function sanitizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'bigint' ? Number(v) : v;
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

async function readParquet(filePath) {
  const reader = await ParquetReader.openFile(filePath);
  const cursor = reader.getCursor();
  const rows = [];
  let record;
  while ((record = await cursor.next()) !== null) rows.push(record);
  await reader.close();
  return rows;
}

async function downloadBlob(blobName, connectionString, containerName) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const safeName = blobName.replace(/[\\/]/g, '__');
  const dest = path.join(TEMP_DIR, safeName);
  const client = BlobServiceClient.fromConnectionString(connectionString);
  await client.getContainerClient(containerName).getBlobClient(blobName).downloadToFile(dest);
  return dest;
}

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

async function processBlob(blobName, type, connectionString, containerName) {
  const localPath = await downloadBlob(blobName, connectionString, containerName);
  let rows;
  try {
    rows = await readParquet(localPath);
  } finally {
    fs.rmSync(localPath, { force: true });
  }
  let inserted = 0, skipped = 0, rowErrors = 0;
  for (const row of rows) {
    try {
      const added = type === 'flight'
        ? await upsertLogDetail(row)
        : await upsertWeatherData(row);
      added ? inserted++ : skipped++;
    } catch (e) {
      rowErrors++;
    }
  }
  return { rows: rows.length, inserted, skipped, rowErrors };
}

// ── run sync (shared by cron and manual trigger) ───────────────────────────

async function runBlobSyncWithId(runId) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName    = process.env.AZURE_BLOB_CONTAINER || 'wingcopter-data';
  const startTime        = new Date();
  const log = (m) => process.stderr.write(`[BlobSync] ${new Date().toISOString()}  ${m}\n`);

  try {
    log('─── Sync started ───');
    const client    = BlobServiceClient.fromConnectionString(connectionString);
    const container = client.getContainerClient(containerName);

    const found = { flight: [], weather: [] };
    let totalBlobsScanned = 0;
    for await (const blob of container.listBlobsFlat()) {
      totalBlobsScanned++;
      const base = path.basename(blob.name).toLowerCase();
      if (base === FLIGHT_FILE)  found.flight.push(blob.name);
      if (base === WEATHER_FILE) found.weather.push(blob.name);
    }

    log(`Found ${totalBlobsScanned} blobs total, ${found.flight.length} flight + ${found.weather.length} weather parquet files`);

    await BlobSyncRun.findByIdAndUpdate(runId, {
      totalBlobsScanned,
      filesFound: found.flight.length + found.weather.length,
    });

    const blobResults = [];
    let totalInserted = 0, totalSkipped = 0, totalErrors = 0;

    for (const blobName of found.flight) {
      log(`Processing flight: ${blobName}`);
      try {
        const r = await processBlob(blobName, 'flight', connectionString, containerName);
        log(`  ✅ inserted=${r.inserted} skipped=${r.skipped} errors=${r.rowErrors}`);
        blobResults.push({ blob: blobName, type: 'flight', ...r });
        totalInserted += r.inserted; totalSkipped += r.skipped; totalErrors += r.rowErrors;
      } catch (e) {
        log(`  ❌ ${e.message}`);
        blobResults.push({ blob: blobName, type: 'flight', rows: 0, inserted: 0, skipped: 0, rowErrors: 0, error: e.message });
      }
    }

    for (const blobName of found.weather) {
      log(`Processing weather: ${blobName}`);
      try {
        const r = await processBlob(blobName, 'weather', connectionString, containerName);
        log(`  ✅ inserted=${r.inserted} skipped=${r.skipped} errors=${r.rowErrors}`);
        blobResults.push({ blob: blobName, type: 'weather', ...r });
        totalInserted += r.inserted; totalSkipped += r.skipped; totalErrors += r.rowErrors;
      } catch (e) {
        log(`  ❌ ${e.message}`);
        blobResults.push({ blob: blobName, type: 'weather', rows: 0, inserted: 0, skipped: 0, rowErrors: 0, error: e.message });
      }
    }

    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    const endTime = new Date();
    log(`─── Sync complete: inserted=${totalInserted} skipped=${totalSkipped} errors=${totalErrors} ───`);
    return await BlobSyncRun.findByIdAndUpdate(runId, {
      status:    'completed',
      endTime,
      durationMs: endTime - startTime,
      inserted:  totalInserted,
      skipped:   totalSkipped,
      rowErrors: totalErrors,
      blobs:     blobResults,
    }, { new: true });
  } catch (e) {
    process.stderr.write(`[BlobSync] sync failed: ${e.message}\n${e.stack}\n`);
    try {
      await BlobSyncRun.findByIdAndUpdate(runId, {
        status:       'failed',
        endTime:      new Date(),
        errorMessage: e.message,
      });
    } catch (_) { /* ignore DB error on failure path */ }
    // Do NOT rethrow — this runs in background; rethrowing triggers
    // unhandledRejection → gracefulShutdown → process.exit in server.js
  }
}

export async function runBlobSync(triggeredBy = 'manual') {
  const run = await BlobSyncRun.create({ triggeredBy, status: 'running' });
  return runBlobSyncWithId(run._id);
}

// ── HTTP handlers ──────────────────────────────────────────────────────────

export const getConfig = (_req, res) => {
  res.json({
    container:   process.env.AZURE_BLOB_CONTAINER || 'wingcopter-data',
    cronSchedule: process.env.BLOB_SYNC_CRON      || '0 2 * * *',
    configured:  !!process.env.AZURE_STORAGE_CONNECTION_STRING,
    flightFile:  FLIGHT_FILE,
    weatherFile: WEATHER_FILE,
  });
};

export const getRuns = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [runs, total] = await Promise.all([
      BlobSyncRun.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      BlobSyncRun.countDocuments(),
    ]);
    res.json({ runs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const triggerRun = async (req, res) => {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    return res.status(400).json({ message: 'AZURE_STORAGE_CONNECTION_STRING not configured' });
  }
  const running = await BlobSyncRun.findOne({ status: 'running' });
  if (running) return res.status(409).json({ message: 'A sync is already running', runId: running._id });

  // Create the run record first, then kick off processing in background
  const run = await BlobSyncRun.create({ triggeredBy: 'manual', status: 'running' });
  res.json({ message: 'Sync started', runId: run._id });

  // Run in background — pass the existing run id so runBlobSync reuses it
  runBlobSyncWithId(run._id).catch(e => {
    process.stderr.write(`[BlobSync] background sync failed: ${e.message}\n`);
  });
};

export const getRunById = async (req, res) => {
  try {
    const run = await BlobSyncRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ message: 'Run not found' });
    res.json(run);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
