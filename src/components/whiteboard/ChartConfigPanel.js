import React, { useState, useCallback, useRef, useEffect } from 'react';

const ChartConfigPanel = React.memo(({ 
  initialConfig, 
  onConfigUpdate, 
  onClose,
  position = 'right'
}) => {
  // Initialize form data with a callback to prevent unnecessary recalculations
  const [formData, setFormData] = useState(() => ({
    xAxisTitle: initialConfig.xAxisTitle || '',
    yAxisTitle: initialConfig.yAxisTitle || '',
    xAxisUnit: initialConfig.xAxisUnit || 1,
    yAxisUnit: initialConfig.yAxisUnit || 1,
    xAxisStart: initialConfig.xAxisStart || 0,
    yAxisStart: initialConfig.yAxisStart || 0,
    xAxisEnd: initialConfig.xAxisEnd || 10,
    yAxisEnd: initialConfig.yAxisEnd || 10,
    xAxisMode: initialConfig.xAxisMode || 'number',
    yAxisMode: initialConfig.yAxisMode || 'number',
    xAxisStartDate: initialConfig.xAxisStartDate || new Date().toISOString().split('T')[0],
    xAxisEndDate: initialConfig.xAxisEndDate || new Date().toISOString().split('T')[0],
    yAxisStartDate: initialConfig.yAxisStartDate || new Date().toISOString().split('T')[0],
    yAxisEndDate: initialConfig.yAxisEndDate || new Date().toISOString().split('T')[0],
    xAxisCustomValues: initialConfig.xAxisCustomValues || [],
    yAxisCustomValues: initialConfig.yAxisCustomValues || [],
    // Explicitly handle boolean values for axis labels
    showXAxisLabels: initialConfig.showXAxisLabels === undefined ? true : Boolean(initialConfig.showXAxisLabels),
    showYAxisLabels: initialConfig.showYAxisLabels === undefined ? true : Boolean(initialConfig.showYAxisLabels),
    // Add sine wave specific settings only if it's a sine chart
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
    expandedSection: null
  }));

  const configPanelRef = useRef(null);

  // Handle clicks outside the panel
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (configPanelRef.current && !configPanelRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleChange = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const { name, value, type, checked } = e.target;
    
    // For checkboxes, ensure we're setting a strict boolean value
    const newValue = type === 'checkbox' ? checked === true : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Log the change to verify the checkbox state
    if (type === 'checkbox') {
      console.log(`Checkbox ${name} changed to:`, newValue);
    }
  }, []);

  const parseCustomValues = (valuesString) => {
    try {
      // Split by commas and clean up each value
      return valuesString.split(',')
        .map(val => val.trim())
        .filter(val => val !== '');
    } catch (error) {
      console.error('Error parsing custom values:', error);
      return [];
    }
  };

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Create a new processed data object with explicit boolean values for visibility
    const processedData = {
      ...initialConfig, // Preserve any existing config
      ...formData,
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
      Object.assign(processedData, {
        frequency: parseFloat(formData.frequency),
        amplitude: parseFloat(formData.amplitude),
        periods: parseFloat(formData.periods),
        waveType: formData.waveType,
        phaseShift: parseFloat(formData.phaseShift || 0),
        harmonics: parseInt(formData.harmonics || 1),
        enableModulation: Boolean(formData.enableModulation),
        modulationDepth: parseFloat(formData.modulationDepth || 0.5)
      });
    }

    // Log the processed data to verify the visibility settings
    console.log('Chart config update:', {
      showXAxisLabels: processedData.showXAxisLabels,
      showYAxisLabels: processedData.showYAxisLabels
    });

    onConfigUpdate(processedData);
    onClose();
  }, [formData, onConfigUpdate, onClose, initialConfig]);

  const handleContainerClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const getPositionStyle = () => {
    const baseStyle = {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      zIndex: 1000,
      width: '300px',
      maxHeight: '80vh',
      overflowY: 'auto'
    };

    if (position === 'right') {
      return {
        ...baseStyle,
        left: '100%',
        marginLeft: '20px'
      };
    } else {
      return {
        ...baseStyle,
        right: '100%',
        marginRight: '20px'
      };
    }
  };

  const renderXAxisInputs = () => {
    return (
      <>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          marginBottom: '15px',
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <input
            type="checkbox"
            id="showXAxisLabels"
            name="showXAxisLabels"
            checked={Boolean(formData.showXAxisLabels)}
            onChange={handleChange}
            style={{ margin: 0 }}
          />
          <label 
            htmlFor="showXAxisLabels"
            style={{ 
              margin: 0,
              userSelect: 'none',
              cursor: 'pointer'
            }}
          >
            Show X-Axis Labels
          </label>
        </div>
        
        {Boolean(formData.showXAxisLabels) && (
          <>
            {formData.xAxisMode === 'number' && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>X Start:</label>
                    <input
                      type="number"
                      name="xAxisStart"
                      value={formData.xAxisStart}
                      onChange={handleChange}
                      step="1"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>X End:</label>
                    <input
                      type="number"
                      name="xAxisEnd"
                      value={formData.xAxisEnd}
                      onChange={handleChange}
                      step="1"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>X Unit Step:</label>
                  <input
                    type="number"
                    name="xAxisUnit"
                    value={formData.xAxisUnit}
                    onChange={handleChange}
                    min="0.1"
                    step="0.1"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
              </>
            )}
            {formData.xAxisMode === 'date' && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Start Date:</label>
                  <input
                    type="date"
                    name="xAxisStartDate"
                    value={formData.xAxisStartDate}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>End Date:</label>
                  <input
                    type="date"
                    name="xAxisEndDate"
                    value={formData.xAxisEndDate}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
              </div>
            )}
            {formData.xAxisMode === 'custom' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Custom Values (comma-separated):</label>
                <textarea
                  name="xAxisCustomValues"
                  value={formData.xAxisCustomValues}
                  onChange={handleChange}
                  placeholder="e.g., Low, Medium, High"
                  rows={3}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid #ddd',
                    resize: 'vertical'
                  }}
                />
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  Enter values separated by commas
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
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          marginBottom: '15px',
          padding: '8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <input
            type="checkbox"
            id="showYAxisLabels"
            name="showYAxisLabels"
            checked={Boolean(formData.showYAxisLabels)}
            onChange={handleChange}
            style={{ margin: 0 }}
          />
          <label 
            htmlFor="showYAxisLabels"
            style={{ 
              margin: 0,
              userSelect: 'none',
              cursor: 'pointer'
            }}
          >
            Show Y-Axis Labels
          </label>
        </div>

        {Boolean(formData.showYAxisLabels) && (
          <>
            {formData.yAxisMode === 'number' && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Y Start:</label>
                    <input
                      type="number"
                      name="yAxisStart"
                      value={formData.yAxisStart}
                      onChange={handleChange}
                      step="1"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Y End:</label>
                    <input
                      type="number"
                      name="yAxisEnd"
                      value={formData.yAxisEnd}
                      onChange={handleChange}
                      step="1"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Y Unit Step:</label>
                  <input
                    type="number"
                    name="yAxisUnit"
                    value={formData.yAxisUnit}
                    onChange={handleChange}
                    min="0.1"
                    step="0.1"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
              </>
            )}
            {formData.yAxisMode === 'date' && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Start Date:</label>
                  <input
                    type="date"
                    name="yAxisStartDate"
                    value={formData.yAxisStartDate}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>End Date:</label>
                  <input
                    type="date"
                    name="yAxisEndDate"
                    value={formData.yAxisEndDate}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
              </div>
            )}
            {formData.yAxisMode === 'custom' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Custom Values (comma-separated):</label>
                <textarea
                  name="yAxisCustomValues"
                  value={formData.yAxisCustomValues}
                  onChange={handleChange}
                  placeholder="e.g., Poor, Fair, Good, Excellent"
                  rows={3}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid #ddd',
                    resize: 'vertical'
                  }}
                />
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  Enter values separated by commas
                </small>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderChartSection = () => {
    const isExpanded = formData.expandedSection === 'chart';
    
    return (
      <div style={{ 
        marginBottom: '15px',
        position: 'relative'
      }}>
        <div 
          onClick={() => setFormData(prev => ({ ...prev, expandedSection: isExpanded ? null : 'chart' }))}
          style={{
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #ddd',
            transition: 'background-color 0.2s ease',
            ':hover': {
              backgroundColor: '#e0e0e0'
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px' }}>Chart Settings</span>
            <span style={{ color: '#666', fontSize: '12px' }}>
              {formData.waveType === 'sine' ? 'sin(x)' : 
               formData.waveType === 'cosine' ? 'cos(x)' : 'tan(x)'}
            </span>
          </div>
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{
              transform: `rotate(${isExpanded ? '-90deg' : '90deg'})`,
              transition: 'transform 0.2s ease'
            }}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {isExpanded && (
          <div style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            marginLeft: '20px',
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            width: '300px',
            zIndex: 1001,
            border: '1px solid #ddd',
            fontSize: '14px',
            transform: 'translateY(-16px)',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            {/* Wave type selector */}
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              marginBottom: '15px',
              backgroundColor: '#f5f5f5',
              padding: '8px',
              borderRadius: '4px',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: 'white'
            }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, waveType: 'sine' }))}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: formData.waveType === 'sine' ? '#2196F3' : '#e0e0e0',
                  color: formData.waveType === 'sine' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontWeight: formData.waveType === 'sine' ? '600' : '400',
                  fontSize: '13px'
                }}
              >
                sin(x)
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, waveType: 'cosine' }))}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: formData.waveType === 'cosine' ? '#2196F3' : '#e0e0e0',
                  color: formData.waveType === 'cosine' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontWeight: formData.waveType === 'cosine' ? '600' : '400',
                  fontSize: '13px'
                }}
              >
                cos(x)
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, waveType: 'tangent' }))}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: formData.waveType === 'tangent' ? '#2196F3' : '#e0e0e0',
                  color: formData.waveType === 'tangent' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontWeight: formData.waveType === 'tangent' ? '600' : '400',
                  fontSize: '13px'
                }}
              >
                tan(x)
              </button>
            </div>

            {/* Frequency settings */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#444' }}>Base Frequency (Hz)</label>
              <input
                type="number"
                name="frequency"
                value={formData.frequency}
                onChange={handleChange}
                min="0.1"
                step="0.1"
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#444' }}>Phase Shift (radians)</label>
              <input
                type="number"
                name="phaseShift"
                value={formData.phaseShift || 0}
                onChange={handleChange}
                step="0.1"
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#444' }}>Harmonics</label>
              <select
                name="harmonics"
                value={formData.harmonics || 1}
                onChange={handleChange}
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
              >
                <option value={1}>Fundamental</option>
                <option value={2}>Second Harmonic</option>
                <option value={3}>Third Harmonic</option>
                <option value={4}>Fourth Harmonic</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#444' }}>Modulation</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  name="enableModulation"
                  checked={formData.enableModulation || false}
                  onChange={handleChange}
                />
                <span>Enable Frequency Modulation</span>
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
                  style={{ 
                    width: '100%', 
                    padding: '6px', 
                    borderRadius: '4px', 
                    border: '1px solid #ddd',
                    marginTop: '8px',
                    fontSize: '13px'
                  }}
                  placeholder="Modulation Depth (0-1)"
                />
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#444' }}>Amplitude:</label>
              <input
                type="number"
                name="amplitude"
                value={formData.amplitude}
                onChange={handleChange}
                min="0.1"
                step="0.1"
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
              />
              <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '12px' }}>
                Controls the height of the wave
              </small>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#444' }}>Periods:</label>
              <input
                type="number"
                name="periods"
                value={formData.periods}
                onChange={handleChange}
                min="0.5"
                step="0.5"
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
              />
              <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '12px' }}>
                Number of complete cycles to show
              </small>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={configPanelRef}
      className="chart-config-panel"
      style={getPositionStyle()}
      onClick={handleContainerClick}
    >
      <form onSubmit={handleSubmit}>
        {/* Chart settings dropdown for sine charts only */}
        {initialConfig.chartType === 'sine' && renderChartSection()}

        {/* Regular chart configuration */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>X-Axis Title:</label>
          <input
            type="text"
            name="xAxisTitle"
            value={formData.xAxisTitle}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Y-Axis Title:</label>
          <input
            type="text"
            name="yAxisTitle"
            value={formData.yAxisTitle}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>X-Axis Type:</label>
          <select
            name="xAxisMode"
            value={formData.xAxisMode}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="custom">Custom Values</option>
          </select>
        </div>

        {renderXAxisInputs()}

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Y-Axis Type:</label>
          <select
            name="yAxisMode"
            value={formData.yAxisMode}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="custom">Custom Values</option>
          </select>
        </div>

        {renderYAxisInputs()}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
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