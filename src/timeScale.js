// Constants
const TIMESCALE_HIERARCHY = [
    'milliseconds',
    'seconds',
    'minutes',
    'hours',
    'days',
    'weeks',
    'months',
    'years',
    'decades'
];

const BUCKET_SCALE_MAP = {
    'millennium': 'decades',
    'decades': 'years',
    'years': 'months',
    'months': 'weeks',
    'weeks': 'days',
    'days': 'hours',
    'hours': 'minutes',
    'minutes': 'seconds',
    'seconds': 'milliseconds',
    'milliseconds': 'milliseconds'
};

/**
 * Gets the d3 time interval function for a given scale string.
 *
 * @param {Object} d3 - d3 object
 * @param {string} scale - Scale string (e.g., 'days', 'weeks', 'months', 'decades', 'millennium')
 * @returns {Function} d3 time interval function
 */
const getD3TimeInterval = (d3, scale) => {
    switch (scale) {
        case 'millennium':
            // Use d3.timeYear.every(1000) for millennium intervals
            return d3.timeYear.every(1000);
        case 'decades':
            return d3.timeYear.every(10);
        case 'years':
            return d3.timeYear;
        case 'months':
            return d3.timeMonth;
        case 'weeks':
            return d3.timeWeek;
        case 'days':
            return d3.timeDay;
        case 'hours':
            return d3.timeHour;
        case 'minutes':
            return d3.timeMinute;
        case 'seconds':
            return d3.timeSecond;
        case 'milliseconds':
            // d3 doesn't have timeMillisecond, use timeSecond as fallback
            return d3.timeSecond;
        default:
            return d3.timeDay;
    }
};

/**
 * Validates domain and returns start/end dates if valid, null otherwise.
 *
 * @param {Array} domain - Domain array from xScale
 * @returns {Object|null} Object with {start, end} or null if invalid
 */
export const validateDomain = (domain) => {
    if (!domain || domain.length < 2) {
        return null;
    }

    const start = domain[0];
    const end = domain[1];
    
    if (!isValidDate(start) || !isValidDate(end)) {
        return null;
    }

    return { start, end };
};

/**
 * Calculates the expected bucket width in pixels for a given timescale.
 *
 * @param {Object} d3 - d3 object
 * @param {Object} xScale - d3 scaleTime
 * @param {string} bucketScale - Bucket scale string (e.g., 'days', 'weeks', 'months')
 * @returns {number} Expected bucket width in pixels
 */
const calculateBucketWidth = (d3, xScale, bucketScale) => {
    const domainInfo = validateDomain(xScale.domain());
    if (!domainInfo) {
        return 0;
    }

    const timeInterval = getD3TimeInterval(d3, bucketScale);

    // Calculate bucket width by taking a sample bucket at the start of the domain
    const bucketStartDate = timeInterval.floor(domainInfo.start);
    const bucketEndDate = timeInterval.offset(bucketStartDate, 1);
    
    const bucketStart = xScale(bucketStartDate);
    const bucketEnd = xScale(bucketEndDate);
    
    return Math.max(0, bucketEnd - bucketStart);
};

/**
 * Determines the time scale for buckets based on what the axis would actually display.
 * Detects the tick interval and returns the bucket scale (one level smaller than ticks).
 * For 10+ years duration, returns 'years' for buckets.
 * Optionally refines the scale based on bucket size constraints.
 *
 * @param {Object} d3 - d3 object
 * @param {Object} xScale - d3 scaleTime
 * @param {Object} numberDisplayedTicks - Object with tick counts per breakpoint (e.g., { small: 3, medium: 5, ... })
 * @param {string} breakpointLabel - Current breakpoint label (e.g., 'small', 'medium', 'large', 'extra')
 * @param {Object} bucketSize - Optional bucket size constraints: { minWidth: number|null, maxWidth: number|null }
 * @returns {string} Bucket scale: 'milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years', 'decades'
 */
/**
 * Detects tick scale from duration when ticks are not available.
 *
 * @param {number} duration - Duration in milliseconds
 * @returns {string} Tick scale string
 */
const detectTickScaleFromDuration = (duration) => {
    const durationDays = duration / (1000 * 60 * 60 * 24);
    const durationYears = durationDays / 365.25;

    if (durationYears >= 1000) return 'millennium';
    if (durationYears >= 10) return 'decades';
    if (durationDays >= 365) return 'years';
    if (durationDays >= 30) return 'months';
    if (durationDays >= 7) return 'weeks';
    if (durationDays >= 1) return 'days';
    if (duration >= 1000 * 60 * 60) return 'hours';
    if (duration >= 1000 * 60) return 'minutes';
    if (duration >= 1000) return 'seconds';
    return 'milliseconds';
};

/**
 * Detects tick scale by examining intervals between sample ticks.
 *
 * @param {Object} d3 - d3 object
 * @param {Array} sampleTicks - Array of sample tick dates
 * @returns {string} Tick scale string
 */
const detectTickScaleFromTicks = (d3, sampleTicks) => {
    if (!sampleTicks || sampleTicks.length < 2) {
        return 'days';
    }

    const tick1 = sampleTicks[0];
    const tick2 = sampleTicks[1];
    const tickDuration = tick2 - tick1;
    
    // Calculate counts for all time intervals
    const yearCount = d3.timeYear.count(tick1, tick2);
    const monthCount = d3.timeMonth.count(tick1, tick2);
    const weekCount = d3.timeWeek.count(tick1, tick2);
    const dayCount = d3.timeDay.count(tick1, tick2);
    const hourCount = d3.timeHour.count(tick1, tick2);
    const minuteCount = d3.timeMinute.count(tick1, tick2);
    const secondCount = d3.timeSecond.count(tick1, tick2);
    
    // Calculate expected durations for each interval type using d3's offset function
    // This properly handles variable month lengths (e.g., February)
    const candidates = [];
    
    if (yearCount >= 1000) {
        const expectedDuration = d3.timeYear.offset(tick1, yearCount) - tick1;
        candidates.push({ scale: 'millennium', expectedDuration, count: Math.floor(yearCount / 1000) });
    }
    if (yearCount >= 10) {
        const expectedDuration = d3.timeYear.offset(tick1, yearCount) - tick1;
        candidates.push({ scale: 'decades', expectedDuration, count: Math.floor(yearCount / 10) });
    }
    if (yearCount >= 1) {
        const expectedDuration = d3.timeYear.offset(tick1, yearCount) - tick1;
        candidates.push({ scale: 'years', expectedDuration, count: yearCount });
    }
    if (monthCount >= 1) {
        const expectedDuration = d3.timeMonth.offset(tick1, monthCount) - tick1;
        candidates.push({ scale: 'months', expectedDuration, count: monthCount });
    }
    if (weekCount >= 1) {
        const expectedDuration = d3.timeWeek.offset(tick1, weekCount) - tick1;
        candidates.push({ scale: 'weeks', expectedDuration, count: weekCount });
    }
    if (dayCount >= 1) {
        const expectedDuration = d3.timeDay.offset(tick1, dayCount) - tick1;
        candidates.push({ scale: 'days', expectedDuration, count: dayCount });
    }
    if (hourCount >= 1) {
        const expectedDuration = d3.timeHour.offset(tick1, hourCount) - tick1;
        candidates.push({ scale: 'hours', expectedDuration, count: hourCount });
    }
    if (minuteCount >= 1) {
        const expectedDuration = d3.timeMinute.offset(tick1, minuteCount) - tick1;
        candidates.push({ scale: 'minutes', expectedDuration, count: minuteCount });
    }
    if (secondCount >= 1) {
        const expectedDuration = d3.timeSecond.offset(tick1, secondCount) - tick1;
        candidates.push({ scale: 'seconds', expectedDuration, count: secondCount });
    }
    // Always include milliseconds as fallback
    candidates.push({ scale: 'milliseconds', expectedDuration: tickDuration, count: 1 });
    
    // Find the interval type where expected duration is closest to actual duration
    let bestScale = 'milliseconds';
    let minDifference = Infinity;
    
    for (const candidate of candidates) {
        const difference = Math.abs(candidate.expectedDuration - tickDuration);
        if (difference < minDifference) {
            minDifference = difference;
            bestScale = candidate.scale;
        }
    }
    
    return bestScale;
};

/**
 * Refines bucket scale based on bucket size constraints.
 *
 * @param {Object} d3 - d3 object
 * @param {Object} xScale - d3 scaleTime
 * @param {string} bucketScale - Current bucket scale
 * @param {Object} bucketSize - Bucket size constraints: { minWidth: number|null, maxWidth: number|null }
 * @returns {string} Refined bucket scale
 */
const refineBucketScale = (d3, xScale, bucketScale, bucketSize) => {
    let currentWidth = calculateBucketWidth(d3, xScale, bucketScale);
    let currentScaleIndex = TIMESCALE_HIERARCHY.indexOf(bucketScale);
    
    // If bucket scale not found in hierarchy, default to 'days'
    if (currentScaleIndex === -1) {
        currentScaleIndex = TIMESCALE_HIERARCHY.indexOf('days');
        bucketScale = 'days';
        currentWidth = calculateBucketWidth(d3, xScale, bucketScale);
    }

    // Adjust for minWidth: try larger timescales (fewer, wider buckets)
    if (bucketSize.minWidth !== null && currentWidth < bucketSize.minWidth) {
        for (let i = currentScaleIndex + 1; i < TIMESCALE_HIERARCHY.length; i++) {
            const testScale = TIMESCALE_HIERARCHY[i];
            const testWidth = calculateBucketWidth(d3, xScale, testScale);
            if (testWidth >= bucketSize.minWidth) {
                bucketScale = testScale;
                currentWidth = testWidth;
                break;
            }
            // If this is the last scale, use it anyway
            if (i === TIMESCALE_HIERARCHY.length - 1) {
                bucketScale = testScale;
                currentWidth = testWidth;
            }
        }
    }

    // Adjust for maxWidth: try smaller timescales (more, narrower buckets)
    if (bucketSize.maxWidth !== null && currentWidth > bucketSize.maxWidth) {
        for (let i = currentScaleIndex - 1; i >= 0; i--) {
            const testScale = TIMESCALE_HIERARCHY[i];
            const testWidth = calculateBucketWidth(d3, xScale, testScale);
            if (testWidth <= bucketSize.maxWidth) {
                bucketScale = testScale;
                currentWidth = testWidth;
                break;
            }
            // If this is the first scale, use it anyway
            if (i === 0) {
                bucketScale = testScale;
                currentWidth = testWidth;
            }
        }
    }

    return bucketScale;
};

/**
 * Determines the time scale for buckets based on what the axis would actually display.
 * Detects the tick interval and returns the bucket scale (one level smaller than ticks).
 * Optionally refines the scale based on bucket size constraints.
 *
 * @param {Object} d3 - d3 object
 * @param {Object} xScale - d3 scaleTime
 * @param {Object} numberDisplayedTicks - Object with tick counts per breakpoint (e.g., { small: 3, medium: 5, ... })
 * @param {string} breakpointLabel - Current breakpoint label (e.g., 'small', 'medium', 'large', 'extra')
 * @param {Object} bucketSize - Optional bucket size constraints: { minWidth: number|null, maxWidth: number|null }
 * @returns {string} Bucket scale: 'milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years', 'decades'
 */
export const getTimeScale = (d3, xScale, numberDisplayedTicks, breakpointLabel, bucketSize = null) => {
    const domainInfo = validateDomain(xScale.domain());
    if (!domainInfo) {
        return 'days';
    }

    // Get the same tick dates that the axis uses
    const tickCount = (numberDisplayedTicks && breakpointLabel && numberDisplayedTicks[breakpointLabel] !== undefined)
        ? numberDisplayedTicks[breakpointLabel]
        : 10;
    const sampleTicks = xScale.ticks(tickCount);
    
    // Detect tick scale
    let tickScale;
    if (!sampleTicks || sampleTicks.length < 2) {
        const duration = domainInfo.end - domainInfo.start;
        tickScale = detectTickScaleFromDuration(duration);
    } else {
        tickScale = detectTickScaleFromTicks(d3, sampleTicks);
    }

    // Convert tick scale to bucket scale (one level smaller)
    let bucketScale = BUCKET_SCALE_MAP[tickScale] || 'days';

    // Refine bucket scale based on bucket size constraints if provided
    if (bucketSize && (bucketSize.minWidth !== null || bucketSize.maxWidth !== null)) {
        bucketScale = refineBucketScale(d3, xScale, bucketScale, bucketSize);
    }

    return bucketScale;
};

const isValidDate = (date) => {
    return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Determines if heatmap should be used based on the current xScale domain.
 * Returns true for days, weeks, months, and years scales.
 *
 * @param {Object} d3 - d3 object
 * @param {Object} xScale - d3 scaleTime
 * @param {Object} numberDisplayedTicks - Object with tick counts per breakpoint (e.g., { small: 3, medium: 5, ... })
 * @param {string} breakpointLabel - Current breakpoint label (e.g., 'small', 'medium', 'large', 'extra')
 * @param {Object} bucketSize - Optional bucket size constraints: { minWidth: number|null, maxWidth: number|null }
 * @returns {boolean} True if heatmap should be used
 */
export const shouldUseHeatmap = (d3, xScale, numberDisplayedTicks, breakpointLabel, bucketSize = null) => {
    const domainInfo = validateDomain(xScale.domain());
    if (!domainInfo) {
        console.log('[Heatmap] Domain has less than 2 values, not using heatmap');
        return false;
    }

    // Validate dates before processing
    if (!isValidDate(domainInfo.start) || !isValidDate(domainInfo.end)) {
        console.warn('[Heatmap] Invalid domain dates:', {
            domainStart: dateToString(domainInfo.start),
            domainEnd: dateToString(domainInfo.end)
        });
        return false;
    }

    // Check the time scale based on domain duration
    const timeScale = getTimeScale(d3, xScale, numberDisplayedTicks, breakpointLabel, bucketSize);

    // Use heatmap for days, weeks, months, years, and decades
    return ['days', 'weeks', 'months', 'years', 'decades'].includes(timeScale);
};

/**
 * Gets the appropriate d3 time interval function for bucketing based on time scale.
 *
 * @param {Object} d3 - d3 object
 * @param {Object} xScale - d3 scaleTime
 * @param {Object} numberDisplayedTicks - Object with tick counts per breakpoint (e.g., { small: 3, medium: 5, ... })
 * @param {string} breakpointLabel - Current breakpoint label (e.g., 'small', 'medium', 'large', 'extra')
 * @param {Object} bucketSize - Optional bucket size constraints: { minWidth: number|null, maxWidth: number|null }
 * @returns {Function} d3 time interval function (e.g., d3.timeDay, d3.timeWeek)
 */
export const getTimeInterval = (d3, xScale, numberDisplayedTicks, breakpointLabel, bucketSize = null) => {
    const domainInfo = validateDomain(xScale.domain());
    if (!domainInfo) {
        return d3.timeDay;
    }

    const timeScale = getTimeScale(d3, xScale, numberDisplayedTicks, breakpointLabel, bucketSize);
    return getD3TimeInterval(d3, timeScale);
};

