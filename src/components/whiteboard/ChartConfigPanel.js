import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import '../../styles/ChartConfigPanel.css';

const ChartConfigPanel = React.memo(({ 
  initialConfig, 
  onConfigUpdate, 
  onClose,
  position = 'right'
}) => {
  // ==================== State ====================
  const [formData, setFormData] = useState(() => ({
    // Basic chart settings
    title: initialConfig.title || '',
    xAxisTitle: initialConfig.xAxisTitle || '',
    yAxisTitle: initialConfig.yAxisTitle || '',
    
    // X-axis settings
    xAxisMode: initialConfig.xAxisMode || 'number',
    xAxisUnit: initialConfig.xAxisUnit || 1,
    xAxisStart: initialConfig.xAxisStart || 0,
    xAxisEnd: initialConfig.xAxisEnd || 10,
    xAxisStartDate: initialConfig.xAxisStartDate || new Date().toISOString().split('T')[0],
    xAxisEndDate: initialConfig.xAxisEndDate || new Date().toISOString().split('T')[0],
    xAxisCustomValues: initialConfig.xAxisCustomValues || [],
    showXAxisLabels: initialConfig.showXAxisLabels === undefined ? true : Boolean(initialConfig.showXAxisLabels),
    
    // Y-axis settings
    yAxisMode: initialConfig.yAxisMode || 'number',
    yAxisUnit: initialConfig.yAxisUnit || 1,
    yAxisStart: initialConfig.yAxisStart || 0,
    yAxisEnd: initialConfig.yAxisEnd || 10,
    yAxisStartDate: initialConfig.yAxisStartDate || new Date().toISOString().split('T')[0],
    yAxisEndDate: initialConfig.yAxisEndDate || new Date().toISOString().split('T')[0],
    yAxisCustomValues: initialConfig.yAxisCustomValues || [],
    showYAxisLabels: initialConfig.showYAxisLabels === undefined ? true : Boolean(initialConfig.showYAxisLabels),
    
    // Sine wave specific settings (only for sine charts)
    ...(initialConfig.chartType === 'sine' ? {
      frequency: initialConfig.frequency || 1,
      amplitude: initialConfig.amplitude || 1,
      periods: initialConfig.periods || 1,
      waveType: initialConfig.waveType || 'sine',
      phaseShift: initialConfig.phaseShift || 0,
      harmonics: initialConfig.harmonics || 1,
      enableModulation: initialConfig.enableModulation || false,
      modulationDepth: initialConfig.modulationDepth || 0.5
    } : {}),
    
    // Data plotting settings (for XY, bar, and scatter charts)
    ...(['xy', 'bar', 'scatter'].includes(initialConfig.chartType) ? {
      dataMode: initialConfig.dataMode || 'none', // 'none', 'points', 'equation'
      dataPoints: initialConfig.dataPoints || '', // "x1,y1; x2,y2; ..." or JSON array
      dataEquation: initialConfig.dataEquation || '', // e.g., "x^2 + 2*x + 1" or "sin(x)"
      dataPointCount: initialConfig.dataPointCount || 100, // For equation mode
      showDataLine: initialConfig.showDataLine !== false,
      showDataPoints: initialConfig.showDataPoints !== false,
      dataColor: initialConfig.dataColor || '#FF5722',
      xyChartDisplayType: initialConfig.xyChartDisplayType || 'line' // 'line', 'bar', 'scatter' - for XY charts
    } : {}),
    
    // Sankey chart settings
    ...(initialConfig.chartType === 'sankey' ? {
      sankeyData: initialConfig.sankeyData || '', // "source1,target1,value1; source2,target2,value2; ..."
      sankeyFileName: initialConfig.sankeyFileName || '', // Filename of uploaded file
      dataColor: initialConfig.dataColor || '#4CAF50'
    } : {}),
    
    // UI state
    expandedSection: null
  }));

  const configPanelRef = useRef(null);

  // ==================== Effects ====================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (configPanelRef.current && !configPanelRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // ==================== Helper Functions ====================
  const parseCustomValues = (valuesString) => {
    try {
      return valuesString.split(',')
        .map(val => val.trim())
        .filter(val => val !== '');
    } catch (error) {
      return [];
    }
  };

  const getPositionClass = () => {
    return `chart-config-panel ${position}`;
  };

  // ==================== Event Handlers ====================
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked === true : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  }, []);

  const handleContainerClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Create a new processed data object with explicit boolean values for visibility
    const processedData = {
      ...initialConfig, // Preserve any existing config
      ...formData,
      title: formData.title || '',
      xAxisTitle: formData.xAxisTitle || '',
      yAxisTitle: formData.yAxisTitle || '',
      xAxisUnit: parseFloat(formData.xAxisUnit),
      yAxisUnit: parseFloat(formData.yAxisUnit),
      // Explicitly set visibility flags
      showXAxisLabels: formData.showXAxisLabels === true,
      showYAxisLabels: formData.showYAxisLabels === true,
      chartType: initialConfig.chartType // Preserve the chart type
    };

    // Process X axis values based on mode
    if (formData.xAxisMode === 'number') {
      processedData.xAxisStart = parseFloat(formData.xAxisStart);
      processedData.xAxisEnd = parseFloat(formData.xAxisEnd);
    } else if (formData.xAxisMode === 'date') {
      processedData.xAxisStart = new Date(formData.xAxisStartDate).getTime();
      processedData.xAxisEnd = new Date(formData.xAxisEndDate).getTime();
    } else if (formData.xAxisMode === 'custom') {
      processedData.xAxisCustomValues = parseCustomValues(formData.xAxisCustomValues);
    }

    // Process Y axis values based on mode
    if (formData.yAxisMode === 'number') {
      processedData.yAxisStart = parseFloat(formData.yAxisStart);
      processedData.yAxisEnd = parseFloat(formData.yAxisEnd);
    } else if (formData.yAxisMode === 'date') {
      processedData.yAxisStart = new Date(formData.yAxisStartDate).getTime();
      processedData.yAxisEnd = new Date(formData.yAxisEndDate).getTime();
    } else if (formData.yAxisMode === 'custom') {
      processedData.yAxisCustomValues = parseCustomValues(formData.yAxisCustomValues);
    }

    // If it's a sine chart, include the sine-specific settings
    if (initialConfig.chartType === 'sine') {
      const periods = parseFloat(formData.periods);
      Object.assign(processedData, {
        frequency: parseFloat(formData.frequency),
        amplitude: parseFloat(formData.amplitude),
        periods: periods,
        waveType: formData.waveType,
        phaseShift: parseFloat(formData.phaseShift || 0),
        harmonics: parseInt(formData.harmonics || 1),
        enableModulation: Boolean(formData.enableModulation),
        modulationDepth: parseFloat(formData.modulationDepth || 0.5),
        // Automatically set xAxisEnd based on periods (2π per period)
        xAxisEnd: 2 * Math.PI * periods
      });
    }

    // If it's an XY, bar, or scatter chart, include the data plotting settings
    if (['xy', 'bar', 'scatter'].includes(initialConfig.chartType)) {
      Object.assign(processedData, {
        dataMode: formData.dataMode || 'none',
        dataPoints: formData.dataPoints || '',
        dataEquation: formData.dataEquation || '',
        dataPointCount: parseInt(formData.dataPointCount || 100),
        showDataLine: Boolean(formData.showDataLine !== false),
        showDataPoints: Boolean(formData.showDataPoints !== false),
        dataColor: formData.dataColor || '#FF5722',
        xyChartDisplayType: formData.xyChartDisplayType || 'line' // For XY charts
      });
    }

    // If it's a Sankey chart, include the Sankey settings
    if (initialConfig.chartType === 'sankey') {
      Object.assign(processedData, {
        sankeyData: formData.sankeyData || '',
        sankeyFileName: formData.sankeyFileName || '',
        dataColor: formData.dataColor || '#4CAF50'
      });
    }

    onConfigUpdate(processedData);
    onClose();
  }, [formData, onConfigUpdate, onClose, initialConfig]);

  // ==================== Render Functions ====================
  const renderChartSection = () => {
    const isExpanded = formData.expandedSection === 'chart';
    
    return (
      <div className="chart-config-section">
        <div 
          className="chart-settings-header"
          onClick={() => setFormData(prev => ({ ...prev, expandedSection: isExpanded ? null : 'chart' }))}
        >
          <div className="chart-settings-title">
            <span>Chart Settings</span>
            <span>
              {formData.waveType === 'sine' ? 'sin(x)' : 
               formData.waveType === 'cosine' ? 'cos(x)' : 'tan(x)'}
            </span>
          </div>
          <svg 
            className={`chart-settings-arrow ${isExpanded ? 'expanded' : ''}`}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {isExpanded && (
          <div className="chart-settings-nested">
            {/* Wave type selector */}
            <div className="wave-type-selector">
              <button
                type="button"
                className={`wave-type-button ${formData.waveType === 'sine' ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, waveType: 'sine' }))}
              >
                sin(x)
              </button>
              <button
                type="button"
                className={`wave-type-button ${formData.waveType === 'cosine' ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, waveType: 'cosine' }))}
              >
                cos(x)
              </button>
              <button
                type="button"
                className={`wave-type-button ${formData.waveType === 'tangent' ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, waveType: 'tangent' }))}
              >
                tan(x)
              </button>
            </div>

            {/* Frequency settings */}
            <div className="chart-config-section">
              <label>Frequency (Hz)</label>
              <input
                type="number"
                name="frequency"
                value={formData.frequency}
                onChange={handleChange}
                min="0.1"
                step="0.1"
              />
            </div>

            <div className="chart-config-section">
              <label>Phase Shift</label>
              <input
                type="number"
                name="phaseShift"
                value={formData.phaseShift || 0}
                onChange={handleChange}
                step="0.1"
              />
            </div>

            <div className="chart-config-section">
              <label>Harmonics</label>
              <select
                name="harmonics"
                value={formData.harmonics || 1}
                onChange={handleChange}
              >
                <option value={1}>Fundamental</option>
                <option value={2}>Second</option>
                <option value={3}>Third</option>
                <option value={4}>Fourth</option>
              </select>
            </div>

            <div className="chart-config-section">
              <label>Modulation</label>
              <div className="checkbox-section">
                <input
                  type="checkbox"
                  name="enableModulation"
                  checked={formData.enableModulation || false}
                  onChange={handleChange}
                />
                <label>Enable FM</label>
              </div>
              {formData.enableModulation && (
                <input
                  type="number"
                  name="modulationDepth"
                  value={formData.modulationDepth || 0.5}
                  onChange={handleChange}
                  min="0"
                  max="1"
                  step="0.1"
                  placeholder="Depth (0-1)"
                />
              )}
            </div>

            <div className="chart-config-section">
              <label>Amplitude:</label>
              <input
                type="number"
                name="amplitude"
                value={formData.amplitude}
                onChange={handleChange}
                min="0.1"
                step="0.1"
              />
              <small className="help-text">
                Wave height
              </small>
            </div>

            <div className="chart-config-section">
              <label>Periods:</label>
              <input
                type="number"
                name="periods"
                value={formData.periods}
                onChange={handleChange}
                min="0.5"
                step="0.5"
              />
              <small className="help-text">
                Number of cycles
              </small>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderXAxisInputs = () => {
    return (
      <>
        <div className="checkbox-section">
          <input
            type="checkbox"
            id="showXAxisLabels"
            name="showXAxisLabels"
            checked={Boolean(formData.showXAxisLabels)}
            onChange={handleChange}
          />
          <label htmlFor="showXAxisLabels">
            Show X-Axis Labels
          </label>
        </div>
        
        {Boolean(formData.showXAxisLabels) && (
          <>
            {formData.xAxisMode === 'number' && (
              <>
                {initialConfig.chartType === 'sine' ? (
                  <div className="input-container">
                    <label>Periods:</label>
                    <input
                      type="number"
                      name="periods"
                      value={formData.periods}
                      onChange={handleChange}
                      min="0.5"
                      step="0.5"
                    />
                  </div>
                ) : (
                  <>
                    <div className="input-group">
                      <div>
                        <label>X Start:</label>
                        <input
                          type="number"
                          name="xAxisStart"
                          value={formData.xAxisStart}
                          onChange={handleChange}
                          step="1"
                        />
                      </div>
                      <div>
                        <label>X End:</label>
                        <input
                          type="number"
                          name="xAxisEnd"
                          value={formData.xAxisEnd}
                          onChange={handleChange}
                          step="1"
                        />
                      </div>
                    </div>
                    <div className="input-container">
                      <label>X Unit Step:</label>
                      <input
                        type="number"
                        name="xAxisUnit"
                        value={formData.xAxisUnit}
                        onChange={handleChange}
                        min="0.1"
                        step="0.1"
                      />
                    </div>
                  </>
                )}
              </>
            )}
            {formData.xAxisMode === 'date' && (
              <div className="input-group">
                <div>
                  <label>Start Date:</label>
                  <input
                    type="date"
                    name="xAxisStartDate"
                    value={formData.xAxisStartDate}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label>End Date:</label>
                  <input
                    type="date"
                    name="xAxisEndDate"
                    value={formData.xAxisEndDate}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
            {formData.xAxisMode === 'custom' && (
              <div className="input-container">
                <label>Custom Values:</label>
                <textarea
                  name="xAxisCustomValues"
                  value={formData.xAxisCustomValues}
                  onChange={handleChange}
                  placeholder="Low, Medium, High"
                  rows={2}
                />
                <small className="help-text">
                  Comma-separated values
                </small>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderYAxisInputs = () => {
    return (
      <>
        <div className="y-axis-checkbox-section">
          <input
            type="checkbox"
            id="showYAxisLabels"
            name="showYAxisLabels"
            checked={Boolean(formData.showYAxisLabels)}
            onChange={handleChange}
          />
          <label 
            htmlFor="showYAxisLabels"
          >
            Show Y-Axis Labels
          </label>
        </div>

        {Boolean(formData.showYAxisLabels) && (
          <>
            {formData.yAxisMode === 'number' && (
              <>
                <div className="input-group">
                  <div>
                    <label>Y Start:</label>
                    <input
                      type="number"
                      name="yAxisStart"
                      value={formData.yAxisStart}
                      onChange={handleChange}
                      step="1"
                    />
                  </div>
                  <div>
                    <label>Y End:</label>
                    <input
                      type="number"
                      name="yAxisEnd"
                      value={formData.yAxisEnd}
                      onChange={handleChange}
                      step="1"
                    />
                  </div>
                </div>
                <div className="input-container">
                  <label>Y Unit Step:</label>
                  <input
                    type="number"
                    name="yAxisUnit"
                    value={formData.yAxisUnit}
                    onChange={handleChange}
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </>
            )}
            {formData.yAxisMode === 'date' && (
              <div className="input-group">
                <div>
                  <label>Start Date:</label>
                  <input
                    type="date"
                    name="yAxisStartDate"
                    value={formData.yAxisStartDate}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label>End Date:</label>
                  <input
                    type="date"
                    name="yAxisEndDate"
                    value={formData.yAxisEndDate}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
            {formData.yAxisMode === 'custom' && (
              <div className="input-container">
                <label>Custom Values:</label>
                <textarea
                  name="yAxisCustomValues"
                  value={formData.yAxisCustomValues}
                  onChange={handleChange}
                  placeholder="Poor, Fair, Good, Excellent"
                  rows={2}
                />
                <small className="help-text">
                  Comma-separated values
                </small>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderSankeyDataSection = () => {
    const isExpanded = formData.expandedSection === 'sankey';
    
    const handleFileUpload = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      
      if (file.name.endsWith('.csv')) {
        // Handle CSV files
        reader.onload = (event) => {
          try {
            const text = event.target.result;
            // Parse CSV file
            const lines = text.split('\n').filter(line => line.trim());
            const rows = lines.map(line => {
              // Handle CSV with potential quotes and commas
              const values = [];
              let current = '';
              let inQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  values.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              values.push(current.trim());
              return values;
            });
            
            // Convert to sankey format: source,target,value
            // Assume first row is header, skip it
            // Expect columns: source, target, value (or similar)
            const dataRows = rows.slice(1).filter(row => row.length >= 3);
            const parsedData = dataRows
              .map(row => {
                const source = row[0]?.trim() || '';
                const target = row[1]?.trim() || '';
                const value = row[2]?.trim() || '0';
                return `${source},${target},${value}`;
              })
              .filter(link => link.split(',')[0] && link.split(',')[1]) // Filter out empty rows
              .join('; ');
            
            if (parsedData) {
              setFormData(prev => ({ ...prev, sankeyData: parsedData, sankeyFileName: file.name }));
            } else {
              alert('No valid data found in the file. Please ensure the file has Source, Target, and Value columns.');
            }
          } catch (error) {
            console.error('Error parsing CSV file:', error);
            alert('Error parsing CSV file. Please check the format and try again.');
          }
          
          // Reset file input
          e.target.value = '';
        };
        
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // Handle XLSX/XLS files
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON array
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Convert to sankey format: source,target,value
            // Assume first row is header, skip it
            // Expect columns: source, target, value (or similar)
            const dataRows = jsonData.slice(1).filter(row => row.length >= 3 && row[0] && row[1]);
            const parsedData = dataRows
              .map(row => {
                const source = String(row[0] || '').trim();
                const target = String(row[1] || '').trim();
                const value = String(row[2] || '0').trim();
                return `${source},${target},${value}`;
              })
              .filter(link => {
                const parts = link.split(',');
                return parts[0] && parts[1]; // Filter out empty rows
              })
              .join('; ');
            
            if (parsedData) {
              setFormData(prev => ({ ...prev, sankeyData: parsedData, sankeyFileName: file.name }));
            } else {
              alert('No valid data found in the file. Please ensure the file has Source, Target, and Value columns.');
            }
          } catch (error) {
            console.error('Error parsing XLSX file:', error);
            alert('Error parsing XLSX file. Please check the format and try again.');
          }
          
          // Reset file input
          e.target.value = '';
        };
        
        reader.readAsArrayBuffer(file);
      } else {
        alert('Please upload a CSV or XLSX file.');
        e.target.value = '';
      }
    };
    
    return (
      <div className="chart-config-section">
        <div 
          className="chart-settings-header"
          onClick={() => setFormData(prev => ({ ...prev, expandedSection: isExpanded ? null : 'sankey' }))}
        >
          <div className="chart-settings-title">
            <span>Sankey Data</span>
          </div>
          <svg 
            className={`chart-settings-arrow ${isExpanded ? 'expanded' : ''}`}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {isExpanded && (
          <div className="chart-settings-nested">
            <div className="input-container">
              <label>Upload CSV File:</label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              {formData.sankeyFileName && (
                <div style={{
                  marginBottom: '8px',
                  padding: '6px 10px',
                  backgroundColor: '#e8f5e9',
                  border: '1px solid #4CAF50',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#2e7d32'
                }}>
                  <strong>File loaded:</strong> {formData.sankeyFileName}
                </div>
              )}
              <small className="help-text" style={{ display: 'block', marginBottom: '12px', color: '#666' }}>
                <strong>File Format:</strong> Upload CSV or XLSX files with the following structure:
                <br />
                <strong>Required columns:</strong> Source, Target, Value (first row should be headers)
                <br />
                <br />
                <strong>Example CSV/XLSX content:</strong>
                <br />
                <code style={{ fontSize: '11px', display: 'block', marginTop: '4px', padding: '6px', background: '#f5f5f5', borderRadius: '2px', lineHeight: '1.6' }}>
                  Source,Target,Value<br />
                  A,B,100<br />
                  A,C,50<br />
                  B,D,80<br />
                  C,D,20
                </code>
                <br />
                <strong>Notes:</strong>
                <br />
                • First row is treated as headers and will be skipped
                <br />
                • Column order: Source (column 1), Target (column 2), Value (column 3)
                <br />
                • Empty rows are automatically filtered out
              </small>
            </div>
            
            <div className="input-container">
              <label>Sankey Flow Data:</label>
              <textarea
                name="sankeyData"
                value={formData.sankeyData || ''}
                onChange={handleChange}
                placeholder="Source1,Target1,100; Source2,Target2,50; Source1,Target2,30"
                rows={6}
              />
              <small className="help-text">
                Format: source,target,value; source,target,value; ... (semicolon-separated)
                <br />
                Example: A,B,100; A,C,50; B,D,80; C,D,20
              </small>
            </div>
            <div className="input-container">
              <label>Flow Color:</label>
              <input
                type="color"
                name="dataColor"
                value={formData.dataColor || '#4CAF50'}
                onChange={handleChange}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDataPlottingSection = () => {
    const isExpanded = formData.expandedSection === 'data';
    
    return (
      <div className="chart-config-section">
        <div 
          className="chart-settings-header"
          onClick={() => setFormData(prev => ({ ...prev, expandedSection: isExpanded ? null : 'data' }))}
        >
          <div className="chart-settings-title">
            <span>Data Plotting</span>
          </div>
          <svg 
            className={`chart-settings-arrow ${isExpanded ? 'expanded' : ''}`}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {isExpanded && (
          <div className="chart-settings-nested">
            <div className="chart-config-section">
              <label>Data Mode:</label>
              <select
                name="dataMode"
                value={formData.dataMode || 'none'}
                onChange={handleChange}
              >
                <option value="none">None</option>
                <option value="points">Data Points</option>
                <option value="equation">Equation/Formula</option>
              </select>
            </div>

            {formData.dataMode === 'points' && (
              <>
                <div className="input-container">
                  <label>Data Points (x,y pairs):</label>
                  <textarea
                    name="dataPoints"
                    value={formData.dataPoints || ''}
                    onChange={handleChange}
                    placeholder="1,2; 2,4; 3,6; 4,8"
                    rows={4}
                  />
                  <small className="help-text">
                    Format: x1,y1; x2,y2; x3,y3; ... (semicolon-separated)
                  </small>
                </div>
              </>
            )}

            {formData.dataMode === 'equation' && (
              <>
                <div className="input-container">
                  <label>Equation/Formula:</label>
                  <input
                    type="text"
                    name="dataEquation"
                    value={formData.dataEquation || ''}
                    onChange={handleChange}
                    placeholder="x^2 + 2*x + 1"
                  />
                  <small className="help-text">
                    Use 'x' as variable. Supports: +, -, *, /, ^, sin, cos, tan, log, exp, sqrt, abs, Math.PI, Math.E
                  </small>
                </div>
                <div className="input-container">
                  <label>Number of Points:</label>
                  <input
                    type="number"
                    name="dataPointCount"
                    value={formData.dataPointCount || 100}
                    onChange={handleChange}
                    min="10"
                    max="1000"
                    step="10"
                  />
                </div>
              </>
            )}

            {formData.dataMode !== 'none' && (
              <>
                {/* Only show line/points options for XY charts with line display type */}
                {initialConfig.chartType === 'xy' && formData.xyChartDisplayType === 'line' && (
                  <>
                    <div className="checkbox-section">
                      <input
                        type="checkbox"
                        name="showDataLine"
                        checked={formData.showDataLine !== false}
                        onChange={handleChange}
                      />
                      <label>Show Line</label>
                    </div>
                    <div className="checkbox-section">
                      <input
                        type="checkbox"
                        name="showDataPoints"
                        checked={formData.showDataPoints !== false}
                        onChange={handleChange}
                      />
                      <label>Show Points</label>
                    </div>
                  </>
                )}
                <div className="input-container">
                  <label>Data Color:</label>
                  <input
                    type="color"
                    name="dataColor"
                    value={formData.dataColor || '#FF5722'}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==================== Main Render ====================
  return (
    <div
      ref={configPanelRef}
      className={getPositionClass()}
      onClick={handleContainerClick}
    >
      <form onSubmit={handleSubmit}>
        {/* Sine wave specific settings */}
        {initialConfig.chartType === 'sine' && renderChartSection()}

        {/* Basic Chart Information */}
        <div className="chart-config-section">
          <label>Chart Title:</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
          />
        </div>

        {/* X-Axis and Y-Axis configuration - hidden for Sankey charts */}
        {initialConfig.chartType !== 'sankey' && (
          <>
            <div className="chart-config-section">
              <label>X-Axis Title:</label>
              <input
                type="text"
                name="xAxisTitle"
                value={formData.xAxisTitle}
                onChange={handleChange}
              />
            </div>

            <div className="chart-config-section">
              <label>Y-Axis Title:</label>
              <input
                type="text"
                name="yAxisTitle"
                value={formData.yAxisTitle}
                onChange={handleChange}
              />
            </div>

            {/* X-Axis Configuration */}
            <div className="chart-config-section">
          <label>X-Axis Type:</label>
          <select
            name="xAxisMode"
            value={formData.xAxisMode}
            onChange={handleChange}
          >
            <option value="number">{initialConfig.chartType === 'sine' ? 'Periods' : 'Number'}</option>
            <option value="date">Date</option>
            <option value="custom">Custom Values</option>
          </select>
            </div>
            {renderXAxisInputs()}

            {/* Y-Axis Configuration */}
            <div className="chart-config-section">
              <label>Y-Axis Type:</label>
              <select
                name="yAxisMode"
                value={formData.yAxisMode}
                onChange={handleChange}
              >
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="custom">Custom Values</option>
              </select>
            </div>
            {renderYAxisInputs()}
          </>
        )}

        {/* Chart Type Selector (for XY charts) */}
        {initialConfig.chartType === 'xy' && (
          <div className="chart-config-section">
            <label>Chart Display Type:</label>
            <select
              name="xyChartDisplayType"
              value={formData.xyChartDisplayType || 'line'}
              onChange={handleChange}
            >
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="scatter">Scatter Plot</option>
            </select>
          </div>
        )}

        {/* Data Plotting Section (for XY, bar, and scatter charts) */}
        {['xy', 'bar', 'scatter'].includes(initialConfig.chartType) && renderDataPlottingSection()}

        {/* Sankey Chart Data Section */}
        {initialConfig.chartType === 'sankey' && renderSankeyDataSection()}

        <div className="button-group">
          <button
            type="submit"
            className="button-apply"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onClose}
            className="button-cancel"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
});

ChartConfigPanel.displayName = 'ChartConfigPanel';

export default ChartConfigPanel; 