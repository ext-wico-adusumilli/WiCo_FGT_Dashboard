import { FileDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ExcelExportProps {
  data?: any[];
  fetchData?: () => Promise<any[]>;
  dataTransform?: (data: any[]) => any[];
  filename?: string;
  columns?: { key: string; label: string }[];
  className?: string;
  sheets?: { name: string; data: any[]; columns?: { key: string; label: string }[] }[];
}

export function ExcelExport({ 
  data, 
  fetchData,
  dataTransform,
  filename = 'export', 
  columns,
  className = '',
  sheets
}: ExcelExportProps) {
  const { theme } = useTheme();
  
  const exportToExcel = async () => {
    let exportData = data;
    
    // If fetchData is provided, use it to get all data
    if (fetchData) {
      try {
        exportData = await fetchData();
        if (dataTransform) {
          exportData = dataTransform(exportData);
        }
      } catch (error) {
        console.error('Error fetching data for export:', error);
        alert('Failed to fetch data for export. Please try again.');
        return;
      }
    }
    
    if ((!exportData || exportData.length === 0) && (!sheets || sheets.length === 0)) {
      alert('No data to export');
      return;
    }

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();

      // If sheets are provided, create multiple sheets
      if (sheets && sheets.length > 0) {
        for (const sheet of sheets) {
          const worksheet = workbook.addWorksheet(sheet.name);
          
          // Determine columns
          let exportColumns = sheet.columns;
          if (!exportColumns && sheet.data.length > 0) {
            const firstItem = sheet.data[0];
            exportColumns = Object.keys(firstItem).map(key => ({
              key,
              label: key
            }));
          }

          if (exportColumns && exportColumns.length > 0) {
            // Check if first row is a title row
            const firstRowData = sheet.data.length > 0 ? sheet.data[0] : null;
            const firstCellValue = firstRowData ? String(firstRowData[exportColumns[0].key] || '') : '';
            const hasTitleRow = firstCellValue.includes('Overview') || firstCellValue.includes('|');
            
            let dataStartIndex = 0;
            
            // Add title row if present
            if (hasTitleRow && firstRowData) {
              const titleRow = worksheet.addRow([firstCellValue]);
              titleRow.font = { bold: true, size: 14, color: { argb: 'FF2E5BFF' } };
              titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
              titleRow.height = 30;
              
              // Merge cells across all columns for title
              worksheet.mergeCells(1, 1, 1, exportColumns.length);
              
              // Add empty row for spacing
              worksheet.addRow([]);
              dataStartIndex = 1; // Skip the title row in data
            }

            // Add headers
            const headers = exportColumns.map(col => col.label);
            const headerRow = worksheet.addRow(headers);

            // Style header row
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF2E5BFF' } // Blue background
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Add data rows (skip title and empty rows)
            sheet.data.slice(dataStartIndex).forEach((item, index) => {
              const rowData = exportColumns!.map(col => {
                const value = item[col.key];
                return value !== null && value !== undefined ? value : '';
              });
              
              // Skip empty rows
              const isEmptyRow = rowData.every(cell => cell === '' || cell === null || cell === undefined);
              if (isEmptyRow) return;
              
              const row = worksheet.addRow(rowData);

              // Center align all cells
              row.alignment = { vertical: 'middle', horizontal: 'center' };
              
              // Alternating row colors
              if ((index + 1) % 2 === 0) {
                row.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF0F4FF' }
                };
              }
            });

            // Auto-fit columns
            worksheet.columns.forEach(column => {
              let maxLength = 0;
              column.eachCell?.({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                  maxLength = columnLength;
                }
              });
              column.width = Math.min(Math.max(maxLength + 2, 10), 50);
            });

            // Freeze header row (accounting for title rows)
            const freezeRow = hasTitleRow ? 4 : 1; // Title + empty + headers = 3 rows, so freeze at 4
            worksheet.views = [{ state: 'frozen', ySplit: freezeRow }];
          }
        }
      } else {
        // Single sheet export
        const worksheet = workbook.addWorksheet('Data');
        
        // Determine columns
        let exportColumns = columns;
        if (!exportColumns && exportData && exportData.length > 0) {
          const firstItem = exportData[0];
          exportColumns = Object.keys(firstItem).map(key => ({
            key,
            label: key
          }));
        }

        if (exportColumns && exportColumns.length > 0) {
          // Check if first row is a title row
          const firstRowData = exportData && exportData.length > 0 ? exportData[0] : null;
          const firstCellValue = firstRowData ? String(firstRowData[exportColumns[0].key] || '') : '';
          const hasTitleRow = firstCellValue.includes('Overview') || firstCellValue.includes('|');
          
          let dataStartIndex = 0;
          
          // Add title row if present
          if (hasTitleRow && firstRowData) {
            const titleRow = worksheet.addRow([firstCellValue]);
            titleRow.font = { bold: true, size: 14, color: { argb: 'FF2E5BFF' } };
            titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
            titleRow.height = 30;
            
            // Merge cells across all columns for title
            worksheet.mergeCells(1, 1, 1, exportColumns.length);
            
            // Add empty row for spacing
            worksheet.addRow([]);
            dataStartIndex = 1; // Skip the title row in data
          }

          // Add headers
          const headers = exportColumns.map(col => col.label);
          const headerRow = worksheet.addRow(headers);

          // Style header row
          headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2E5BFF' } // Blue background
          };
          headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

          // Add data rows (skip title and empty rows)
          exportData && exportData.slice(dataStartIndex).forEach((item, index) => {
            const rowData = exportColumns!.map(col => {
              const value = item[col.key];
              return value !== null && value !== undefined ? value : '';
            });
            
            // Skip empty rows
            const isEmptyRow = rowData.every(cell => cell === '' || cell === null || cell === undefined);
            if (isEmptyRow) return;
            
            const row = worksheet.addRow(rowData);

            // Center align all cells
            row.alignment = { vertical: 'middle', horizontal: 'center' };
            
            // Alternating row colors
            if ((index + 1) % 2 === 0) {
              row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F4FF' }
              };
            }
          });

          // Auto-fit columns
          worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell?.({ includeEmpty: true }, cell => {
              const columnLength = cell.value ? cell.value.toString().length : 10;
              if (columnLength > maxLength) {
                maxLength = columnLength;
              }
            });
            column.width = Math.min(Math.max(maxLength + 2, 10), 50);
          });

          // Freeze header row (accounting for title rows)
          const freezeRow = hasTitleRow ? 4 : 1; // Title + empty + headers = 3 rows, so freeze at 4
          worksheet.views = [{ state: 'frozen', ySplit: freezeRow }];
        }
      }

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;

      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    }
  };

  return (
    <button
      onClick={exportToExcel}
      className={`flex items-center gap-1 px-2 py-1.5 h-[30px] rounded transition text-xs ${
        theme === 'dark'
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-gray-900 hover:bg-gray-800 text-white'
      } ${className}`}
      title="Export to Excel"
    >
      <FileDown className="w-3 h-3" />
      <span className="text-xs">Export</span>
    </button>
  );
}

