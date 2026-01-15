import * as d3 from 'd3';

import eventDrops from '../src';
import '../src/style.css';
import './demo.css';
import { gravatar, humanizeDate } from './utils';

const repositories = require('./data.json');

const numberCommitsContainer = document.getElementById('numberCommits');
const zoomStart = document.getElementById('zoomStart');
const zoomEnd = document.getElementById('zoomEnd');

const updateCommitsInformation = chart => {
    const filteredData = chart
        .filteredData()
        .reduce((total, repo) => total.concat(repo.data), []);

    numberCommitsContainer.textContent = filteredData.length;
    zoomStart.textContent = humanizeDate(chart.scale().domain()[0]);
    zoomEnd.textContent = humanizeDate(chart.scale().domain()[1]);
};

const tooltip = d3
    .select('body')
    .append('div')
    .classed('tooltip', true)
    .style('opacity', 0)
    .style('pointer-events', 'auto');

const chart = eventDrops({
    d3,
    bucketSize: {
        minWidth: 10,
        maxWidth: 180,
    },
    zoom: {
        onZoomEnd: () => {
            updateCommitsInformation(chart);
        },
        onZoom: () => {
            const domain = chart.scale().domain();
        }
    },
    drop: {
        date: d => new Date(d.date),
        onMouseOver: (ev, data) => {
            tooltip
                .transition()
                .duration(200)
                .style('opacity', 1)
                .style('pointer-events', 'auto');

            // Check if this is a heatmap bucket (has count property) or individual commit
            if (data.count !== undefined && data.events) {
                // Heatmap bucket - show aggregated information
                const bucketDate = humanizeDate(data.date);
                tooltip
                    .html(
                        `
                        <div class="heatmap-bucket">
                            <h3>${data.count} commit${data.count !== 1 ? 's' : ''}</h3>
                            <p class="date">${bucketDate}</p>
                            <p class="light">Zoom in to see individual commits</p>
                        </div>
                    `
                    )
                    .style('left', `${ev.pageX - 30}px`)
                    .style('top', `${ev.pageY + 20}px`);
            } else {
                // Individual commit
                tooltip
                    .html(
                        `
                        <div class="commit">
                        <img class="avatar" src="${gravatar(
                            data.author.email
                        )}" alt="${data.author.name}" title="${
                            data.author.name
                        }" />
                        <div class="content">
                            <h3 class="message">${data.message}</h3>
                            <p>
                                <a href="https://www.github.com/${
                                    data.author.name
                                }" class="author">${data.author.name}</a>
                                on <span class="date">${humanizeDate(
                                    new Date(data.date)
                                )}</span> -
                                <a class="sha" href="${
                                    data.sha
                                }">${data.sha.substr(0, 10)}</a>
                            </p>
                        </div>
                    `
                    )
                    .style('left', `${ev.pageX - 30}px`)
                    .style('top', `${ev.pageY + 20}px`);
            }
        },
        onMouseOut: () => {
            tooltip
                .transition()
                .duration(500)
                .style('opacity', 0)
                .style('pointer-events', 'none');
        },
    },
});

const repositoriesData = repositories.map(repository => ({
    name: repository.name,
    data: repository.commits,
}));

d3
    .select('#eventdrops-demo')
    .data([repositoriesData])
    .call(chart);

updateCommitsInformation(chart);
