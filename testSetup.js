// Use the UMD build instead of ES modules to avoid transformation issues
const d3 = require('d3');

global.d3 = { ...d3 }; // copy to prevent errors like "TypeError: Cannot set property axisTop of #<Object> which has only a getter"
