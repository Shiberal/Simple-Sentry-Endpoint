/**
 * Server Performance Utilities
 * 
 * Provides tools to measure and record server-side processing time
 * for incoming events.
 */

/**
 * Creates a performance tracker object
 * @returns {Object} Tracker with start and mark methods
 */
export function createTracker() {
  const startTime = Date.now();
  const timings = {
    _start: startTime
  };

  return {
    /**
     * Mark a point in time with a label
     * @param {string} label - The label for this point
     */
    mark(label) {
      timings[label] = Date.now() - startTime;
    },

    /**
     * Get all collected timings
     * @returns {Object} The collected timings
     */
    getTimings() {
      const totalTime = Date.now() - startTime;
      return {
        ...timings,
        totalTime
      };
    }
  };
}

/**
 * Wraps event data with performance metrics
 * @param {Object} eventData - Original event data
 * @param {Object} timings - Timings from tracker
 * @returns {Object} Updated event data
 */
export function withPerformance(eventData, timings) {
  return {
    ...eventData,
    _serverPerformance: timings
  };
}
