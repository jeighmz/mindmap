import React, { useState, useCallback, useRef, useEffect } from 'react';
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
    
    // Data plotting settings (only for XY charts)
    ...(initialConfig.chartType === 'xy' ? {
      dataMode: initialConfig.dataMode || 'none', // 'none', 'points', 'equation'
      dataPoints: initialConfig.dataPoints || '', // "x1,y1; x2,y2; ..." or JSON array
      dataEquation: initialConfig.dataEquation || '', // e.g., "x^2 + 2*x + 1" or "sin(x)"
      dataPointCount: initialConfig.dataPointCount || 100, // For equation mode
      showDataLine: initialConfig.showDataLine !== false,
      showDataPoints: initialConfig.showDataPoints !== false,
      dataColor: initialConfig.dataColor || '#FF5722'
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

    // If it's an XY chart, include the data plotting settings
    if (initialConfig.chartType === 'xy') {
      Object.assign(processedData, {
        dataMode: formData.dataMode || 'none',
        dataPoints: formData.dataPoints || '',
        dataEquation: formData.dataEquation || '',
        dataPointCount: parseInt(formData.dataPointCount || 100),
        showDataLine: Boolean(formData.showDataLine !== false),
        showDataPoints: Boolean(formData.showDataPoints !== false),
        dataColor: formData.dataColor || '#FF5722'
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

        {/* Data Plotting Section (only for XY charts) */}
        {initialConfig.chartType === 'xy' && renderDataPlottingSection()}

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