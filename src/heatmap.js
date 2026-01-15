import { getTimeInterval, validateDomain } from './timeScale';

/**
 * Aggregates events into time buckets based on the current time scale.
 * Only creates buckets for time periods that contain events (empty buckets are excluded).
 *
 * @param {Object} xScale - d3 scaleTime
 * @param {Function} dropDate - Function to extract date from event data
 * @param {Array} events - Array of event data (only for the current row)
 * @param {Function} timeInterval - d3 time interval function (e.g., d3.timeDay, d3.timeWeek)
 * @returns {Array} Array of bucket objects: { date: Date, count: number, events: Array }
 */
const aggregateEvents = (xScale, dropDate, events, timeInterval) => {
    const domain = xScale.domain();
    const domainInfo = validateDomain(domain);
    
    if (!domainInfo) {
        console.warn('[Heatmap] Invalid domain dates, returning empty buckets');
        return [];
    }
    
    const { start: domainStart, end: domainEnd } = domainInfo;
    const bucketStartBound = timeInterval.floor(domainStart);
    const bucketEndBound = timeInterval.ceil(domainEnd);

    const buckets = new Map();

    // Only create buckets for events that fall within the domain range
    if (Array.isArray(events)) {
        events.forEach(event => {
            const eventDate = dropDate(event);
            if (!(eventDate instanceof Date) || isNaN(eventDate.getTime())) {
                return; // Skip invalid dates
            }

            // Check if event is within domain range
            if (eventDate < domainStart || eventDate >= domainEnd) {
                return;
            }

            const bucketDate = timeInterval.floor(eventDate);
            
            if (bucketDate >= bucketStartBound && bucketDate <= bucketEndBound) {
                const bucketKey = bucketDate.getTime();
                
                if (!buckets.has(bucketKey)) {
                    buckets.set(bucketKey, {
                        date: bucketDate,
                        count: 0,
                        events: [],
                    });
                }
                
                const bucket = buckets.get(bucketKey);
                bucket.count += 1;
                bucket.events.push(event);
            }
        });
    }

    // Return buckets sorted by date (only non-empty buckets)
    return Array.from(buckets.values()).sort((a, b) => a.date - b.date);
};

/**
 * Calculates the maximum intensity (event count) from all buckets for a specific row.
 * Always calculates per-row to ensure each row's visualization is independent.
 *
 * @param {Array} buckets - Array of bucket objects for this row
 * @returns {number} Maximum intensity value for this row
 */
const getMaxIntensity = (buckets) => {
    // Always calculate per-row max intensity to ensure each row is normalized independently
    // This ensures rows with different total event counts are visualized correctly
    
    if (buckets.length === 0) {
        return 1;
    }

    const maxCount = Math.max(...buckets.map(b => b.count), 0);
    return maxCount > 0 ? maxCount : 1;
};

/**
 * Resolves the drop color for a row, matching drop.js behavior.
 * When dropColor is null, it inherits from lineColor (parent fill).
 * When dropColor is a function, it's called with (dropData, dropIndex, lineData).
 *
 * @param {*} dropColor - Drop color (null, function, or string)
 * @param {*} lineColor - Line color (function or string)
 * @param {*} rowData - Row data object
 * @param {number} rowIndex - Row index
 * @returns {string} Resolved color string
 */
const resolveDropColor = (dropColor, lineColor, rowData, rowIndex) => {
    if (dropColor === null || dropColor === undefined) {
        // When dropColor is null, it inherits from lineColor (parent fill)
        return typeof lineColor === 'function' 
            ? lineColor(rowData, rowIndex)
            : lineColor;
    } else if (typeof dropColor === 'function') {
        // When dropColor is a function, call it with first drop in row as representative
        // Function signature per docs: (dropData, dropIndex, lineData)
        const firstDrop = rowData && rowData.data && rowData.data.length > 0 
            ? rowData.data[0] 
            : null;
        if (firstDrop) {
            return dropColor(firstDrop, 0, rowData);
        } else {
            // Fallback to lineColor if no drops available
            return typeof lineColor === 'function' 
                ? lineColor(rowData, rowIndex)
                : lineColor;
        }
    } else {
        // dropColor is a string/constant value
        return dropColor;
    }
};

/**
 * Gets the color for a bucket based on intensity
 *
 * @param {Object} config - Configuration object
 * @param {number} intensity - Normalized intensity (0 to 1)
 * @param {string} baseColor - Base color to use (drop color or line color)
 * @returns {string} Color string
 */
const getBucketColor = (config, intensity, baseColor) => {
    const { heatmap: { colorScale } } = config;

    if (colorScale && typeof colorScale === 'function') {
        return colorScale(intensity);
    }

    if (!baseColor) {
        return `rgba(0, 0, 0, ${intensity})`;
    }

    // Handle hex colors (#RRGGBB or #RGB)
    if (baseColor.startsWith('#')) {
        const hex = baseColor.slice(1);
        const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
        const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
        const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${intensity})`;
    }
    
    // Handle rgb/rgba colors (rgb(255, 0, 0) or rgba(255, 0, 0, 0.5))
    const rgbMatch = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        return `rgba(${r}, ${g}, ${b}, ${intensity})`;
    }

    // Fallback: use base color as-is (may already have opacity or be a named color)
    return baseColor;
};

/**
 * Calculates bucket position and width for rendering.
 *
 * @param {Object} d - Bucket datum
 * @param {Object} xScale - d3 scaleTime
 * @param {Function} timeInterval - d3 time interval function
 * @param {number} minBucketWidth - Minimum bucket width in pixels
 * @returns {Object} Object with { x, width }
 */
const calculateBucketPosition = (d, xScale, timeInterval, minBucketWidth) => {
    const bucketStartDate = d.date;
    const bucketEndDate = timeInterval.offset(bucketStartDate, 1);
    
    const bucketStart = xScale(bucketStartDate);
    const bucketEnd = xScale(bucketEndDate);
    
    // Ensure x position is never negative (prevent overflow past left edge)
    const x = Math.max(0, bucketStart);
    
    // Calculate width ensuring minimum, and adjust if x was clamped
    const rawWidth = bucketEnd - bucketStart;
    const width = Math.max(rawWidth, minBucketWidth);
    
    // If the start was clamped to 0, adjust width to account for the portion cut off
    if (x === 0 && bucketStart < 0) {
        return {
            x,
            width: Math.max(minBucketWidth, bucketEnd - x)
        };
    }
    
    return { x, width };
};

/**
 * Extracts row data and index from DOM context for a heatmap rect element.
 * 
 * @param {Object} d3 - d3 object
 * @param {HTMLElement} rectElement - The rect element (this in context)
 * @returns {Object} { rowData, rowIndex }
 */
const getRowDataFromElement = (d3, rectElement) => {
    const dropsNode = rectElement.parentNode; // .drops element
    const dropLineNode = dropsNode ? dropsNode.parentNode : null; // .drop-line element
    
    if (!dropLineNode) {
        // Fallback: use .drops datum
        const dropsData = dropsNode ? d3.select(dropsNode).datum() : null;
        return {
            rowData: dropsData,
            rowIndex: dropsData && dropsData._rowIndex !== undefined ? dropsData._rowIndex : 0
        };
    }
    
    // Get row data from .drop-line element (source of truth)
    const dropLineSelection = d3.select(dropLineNode);
    const dropLineData = dropLineSelection.datum();
    
    // Get row index by finding position in parent's children
    const parentOfDropLine = dropLineNode.parentNode;
    let rowIndex = 0;
    
    if (parentOfDropLine) {
        const siblings = Array.from(parentOfDropLine.children).filter(
            child => child.classList && child.classList.contains('drop-line')
        );
        rowIndex = siblings.indexOf(dropLineNode);
        
        if (rowIndex === -1) {
            // Fallback to _rowIndex if found in .drops datum
            const dropsData = dropsNode ? d3.select(dropsNode).datum() : null;
            rowIndex = dropsData && dropsData._rowIndex !== undefined ? dropsData._rowIndex : 0;
        }
    }
    
    return { rowData: dropLineData, rowIndex };
};

/**
 * Creates a data accessor function for heatmap buckets
 * Intensity is always normalized per-row to ensure each row's visualization
 * is independent and reflects that row's data distribution.
 *
 * @param {Object} xScale - d3 scaleTime
 * @param {Function} dropDate - Function to extract date from event data
 * @param {Function} timeInterval - d3 time interval function (e.g., d3.timeDay, d3.timeWeek)
 * @returns {Function} Data accessor function
 */
const getHeatmapBucketData = (xScale, dropDate, timeInterval) => d => {
    // d is the datum of each .drops element (row data)
    if (!d || !d.data) {
        return [];
    }
    
    const buckets = aggregateEvents(xScale, dropDate, d.data, timeInterval);
    
    const maxCount = getMaxIntensity(buckets);

    return buckets.map(bucket => ({
        ...bucket,
        intensity: maxCount > 0 ? Math.min(bucket.count / maxCount, 1) : 0,
    }));
};

export default (config, xScale, breakpointLabel) => selection => {
    
    const {
        d3,
        drop: {
            color: dropColor,
            date: dropDate,
            onClick,
            onMouseOver,
            onMouseOut,
        },
        line: { color: lineColor, height: lineHeight },
        numberDisplayedTicks,
        bucketSize,
    } = config;
    
    // Get minWidth from bucketSize, defaulting to 2 if not set
    const minBucketWidth = bucketSize && bucketSize.minWidth !== null ? bucketSize.minWidth : 2;

    if (!d3) {
        console.warn('[Heatmap] d3 not available in config, cannot render heatmap');
        return;
    }

    if (selection.empty()) {
        return;
    }

    const timeInterval = getTimeInterval(d3, xScale, numberDisplayedTicks, breakpointLabel, bucketSize);

    const heatmapBucketData = getHeatmapBucketData(xScale, dropDate, timeInterval);

    const getBucketAttributes = (d) => {
        return calculateBucketPosition(d, xScale, timeInterval, minBucketWidth);
    };

    const heatmapRects = selection
        .selectAll('.heatmap-rect')
        .data(heatmapBucketData);

    const enterRects = heatmapRects
        .enter()
        .append('rect')
        .classed('heatmap-rect', true)
        .on('click', (ev, d) => onClick(ev, d))
        .on('mouseover', (ev, d) => onMouseOver(ev, d))
        .on('mousemove', (ev, d) => onMouseOver(ev, d))
        .on('mouseout', (ev, d) => onMouseOut(ev, d));
    
    enterRects.merge(heatmapRects)
        .attr('x', d => {
            const position = getBucketAttributes(d);
            return position.x;
        })
        .attr('width', d => {
            const position = getBucketAttributes(d);
            return position.width;
        })
        .attr('y', -lineHeight / 2)
        .attr('height', lineHeight)
        .attr('fill', function(d) {
            const { rowData, rowIndex } = getRowDataFromElement(d3, this);
            const intensity = d.count > 0 ? d.intensity : 0;
            const resolvedDropColor = resolveDropColor(dropColor, lineColor, rowData, rowIndex);
            return getBucketColor(config, intensity, resolvedDropColor);
        })
        .attr('stroke', 'none');

    heatmapRects
        .exit()
        .each(function() {
            if (onMouseOut) {
                onMouseOut();
            }
        })
        .on('click', null)
        .on('mouseover', null)
        .on('mousemove', null)
        .on('mouseout', null)
        .remove();
};

