import drop from './drop';
import indicator from './indicator';
import heatmap from './heatmap';
import { shouldUseHeatmap } from './timeScale';

export default (config, xScale, breakpointLabel) => selection => {
    const {
        d3,
        metaballs,
        label: {
            text: labelText,
            padding: labelPadding,
            onMouseOver: labelOnMouseOver,
            onMouseOut: labelOnMouseOut,
            onClick: labelOnClick,
            width: labelWidth,
        },
        line: { color: lineColor, height: lineHeight },
        indicator: indicatorEnabled,
        numberDisplayedTicks,
        bucketSize,
    } = config;

    const useHeatmap = shouldUseHeatmap(d3, xScale, numberDisplayedTicks, breakpointLabel, bucketSize);
    const renderComponent = useHeatmap ? heatmap : drop;

    const lines = selection.selectAll('.drop-line').data(d => d);

    const g = lines
        .enter()
        .append('g')
        .classed('drop-line', true)
        .attr('fill', lineColor)
        .attr('transform', (_, index) => `translate(0, ${index * lineHeight})`);

    g
        .append('line')
        .classed('line-separator', true)
        .attr('x1', labelWidth)
        .attr('x2', '100%')
        .attr('y1', () => lineHeight)
        .attr('y2', () => lineHeight);

    const drops = g
        .append('g')
        .classed('drops', true)
        .classed('heatmap-container', useHeatmap)
        .attr('transform', () => `translate(${labelWidth}, ${lineHeight / 2})`)
        .each(function(d, i) {
            // Get parent row data and store row index in datum for heatmap to access
            const parentData = d3.select(this.parentNode).datum();
            d3.select(this).datum({ ...parentData, _rowIndex: i });
        });
    
    // Clean up any existing elements from the opposite component (for new lines)
    // Existing lines are handled in the update section below
    if (useHeatmap) {
        drops.selectAll('.drop').remove();
    } else {
        drops.selectAll('.heatmap-rect').remove();
    }
    
    drops.call(renderComponent(config, xScale, breakpointLabel));

    drops
        .append('rect') // The rect allow us to size the drops g element
        .attr('x', 0)
        .attr('y', -config.line.height / 2)
        .attr('width', 1) // For the rect to impact its parent size it must have a non zero width
        .attr('height', config.line.height)
        .attr('fill', 'transparent');

    // Only apply metaballs filter to dots, not heatmap
    // Also remove filter when switching to heatmap
    if (metaballs && !useHeatmap) {
        drops.style('filter', 'url(#metaballs)');
    } else if (useHeatmap) {
        // Remove metaballs filter when using heatmap
        drops.style('filter', null);
    }

    g
        .append('text')
        .classed('line-label', true)
        .attr('x', labelWidth - labelPadding)
        .attr('y', lineHeight / 2)
        .attr('dy', '0.25em')
        .attr('text-anchor', 'end')
        .text(labelText)
        .on('mouseover', labelOnMouseOver)
        .on('mouseout', labelOnMouseOut)
        .on('click', labelOnClick);

    lines.selectAll('.line-label').text(labelText);
    lines.selectAll('.drops')
        .each(function(d, i) {
            // Get parent row data and store row index in datum for heatmap to access
            if (this && this.parentNode) {
                const parentData = d3.select(this.parentNode).datum();
                d3.select(this).datum({ ...parentData, _rowIndex: i });
            }
        });
    
    // Clean up elements from the opposite component before rendering
    // This ensures smooth transitions when switching between heatmap and drops
    const dropsSelection = lines.selectAll('.drops');
    
    dropsSelection.classed('heatmap-container', useHeatmap);
    
    if (useHeatmap) {
        dropsSelection.selectAll('.drop').remove();
        if (metaballs) {
            dropsSelection.style('filter', null);
        }
    } else {
        dropsSelection.selectAll('.heatmap-rect').remove();
        if (metaballs) {
            dropsSelection.style('filter', 'url(#metaballs)');
        }
    }
    
    dropsSelection.call(renderComponent(config, xScale, breakpointLabel));

    if (indicatorEnabled) {
        g
            .append('g')
            .classed('indicators', true)
            .call(indicator(config, xScale));

        lines.selectAll('.indicators').call(indicator(config, xScale));
    }

    lines.exit().remove();
};
