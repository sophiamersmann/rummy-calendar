import * as d3 from 'd3';
import {
  rollups,
  maxIndex,
  cumsum,
} from 'd3-array';
import d3Tip from 'd3-tip';

import playerColors from '../../style/scss/_global.scss';

function loadDatum(d) {
  return {
    date: d.Date,
    scores: [
      {
        player: 'sophia',
        count: d.Sophia === '' ? null : +d.Sophia,
      },
      {
        player: 'clara',
        count: d.Clara === '' ? null : +d.Clara,
      },
      {
        player: 'marina',
        count: d.Marina === '' ? null : +d.Marina,
      },
    ],
  };
}

function countDay(date) {
  return (date.getUTCDay() + 6) % 7;
}

// TODO: Magic code
function countNumCells(date) {
  switch (d3.utcFormat('%-d/%-m/%y')(date)) {
    case '1/3/20':
      return 5;
    case '1/4/20':
      return 4;
    case '1/5/20':
      return 5;
    case '1/6/20':
      return 4;
    case '1/7/20':
      return 5;
    default:
      return 5;
  }
}

function getWinner(scores) {
  return scores[maxIndex(scores, (d) => d3.sum(d.scores))].player;
}

function fold(data) {
  return rollups(
    data.map((d) => d.scores).flat(),
    (v) => v.map((d) => d.count),
    (d) => d.player,
  ).map((d) => ({
    player: d[0],
    scores: d[1],
  }));
}

function deepcopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function filterScores(data, activePlayers) {
  const activeScores = data.filter((d) => activePlayers.includes(d.player));
  const isValid = d3
    .zip(...activeScores.map((d) => d.scores))
    .map((d) => d.every((x) => x !== null));
  return activeScores.map((d) => ({
    player: d.player,
    scores: d.scores.filter((s, i) => isValid[i]),
  }));
}

function createTipContent(date, elem, info) {
  return `
  <div class="tip-heading">
    <div class="tip-date">${info.prettyDate}</div>
    <div class="tip-games text-muted">${info.nGames ? info.nGames : 'No'} games played</div>
  </div>
  <div id="chart-tip"></div>`;
}

const RommeCal = {
  svg: {
    selector: null, // defined by user
    width: 750,
    height: 500,
  },
  margin: {
    top: 60,
    right: 40,
    bottom: 40,
    left: 60,
  },
  // set after loading data
  data: {
    raw: null,
    scores: null,
    dailyScores: null,
    weeklyScores: null,
    monthlyScores: null,
    yearlyScores: null,
    groupKeys: ['dailyScores', 'weeklyScores', 'monthlyScores', 'yearlyScores'],
    getGroupKey: {
      day: 'dailyScores',
      week: 'weeklyScores',
      month: 'monthlyScores',
      year: 'yearlyScores',
    },
  },
  grid: {
    drawn: false,
    startDate: new Date(2020, 3, 2),
    endDate: new Date(2020, 7, 2),
    // set from startDate and endDate
    dates: null,
    weeks: null,
    months: null,
    years: null,
    cell: {
      classDay: 'rect-day',
      classWeek: 'rect-week',
      classMonth: 'rect-month',
      classYear: 'rect-year',
      size: 36,
      fill: 'whitesmoke',
      stroke: 'white',
      strokeWidth: 1,
      colorTransitionDuration: 400,
    },
    monthLines: {
      fill: 'none',
      stroke: '#fff',
      strokeWidth: 4,
    },
  },
  players: {
    all: ['sophia', 'clara', 'marina'],
    init: ['sophia', 'clara'],
  },
  time: {
    parseDate: d3.timeParse('%d/%m/%y'),
    formatDate: d3.utcFormat('%-d/%-m/%y'),
  },
  labels: {
    xOffset: -15,
    yOffset: -10,
    dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  chartInTip: {
    selector: '#chart-tip',
    width: 225,
    height: 100,
    margin: {
      top: 20,
      right: 35,
      bottom: 10,
      left: 35,
    },
  },
  // updates throughout the life of the chart
  active: {
    players: null,
    scores: null,
    dailyScores: null,
    weeklyScores: null,
    monthlyScores: null,
    yearlyScores: null,
    tip: {
      type: null,
      date: null,
      prettyDate: null,
      scores: null,
      finalScores: null,
      nGames: null,
      winner: null,
    },
  },
};

export default RommeCal;

// days, weeks, months and years to draw
RommeCal.grid.dates = d3.timeDay.range(RommeCal.grid.startDate, RommeCal.grid.endDate);
RommeCal.grid.weeks = d3.utcWeeks(
  d3.utcWeek.ceil(RommeCal.grid.startDate),
  d3.timeDay.offset(d3.timeWeek.ceil(RommeCal.grid.endDate), 1),
);
RommeCal.grid.months = d3.utcMonths(
  d3.utcMonth(RommeCal.grid.startDate),
  d3.timeMonth(RommeCal.grid.endDate),
);
RommeCal.grid.years = [d3.utcYear(RommeCal.grid.startDate)];

RommeCal.updatePlayers = function updatePlayers(newPlayers) {
  this.active.players = newPlayers;

  // update data
  this.active.scores = filterScores(this.data.scores, this.active.players)
    .filter((d) => d.scores.length > 0);
  this.data.groupKeys.forEach((key) => {
    this.active[key] = this.data[key].map((d) => ({
      date: d.date,
      scores: filterScores(d.scores, this.active.players),
    }));
    if (this.active[key][0].scores.length > 0) {
      this.active[key] = this.active[key].filter((d) => d.scores[0].scores.length > 0);
    }
  });

  // update data in tip
  this.updateTipData();

  // re-color grid if drawn
  if (this.grid.drawn) {
    this.colorGrid();
  }
};

RommeCal.updateTipData = function updateTipData() {
  const { type, date } = this.active.tip;

  if (!type) {
    this.clearTipData();
    return;
  }

  // format date to display
  this.active.tip.prettyDate = {
    day: d3.utcFormat('%-d %b')(date),
    week: `${d3.utcFormat('%-d %b')(d3.utcMonday(date))} &ndash; ${d3.utcFormat('%-d %b')(date)}`,
    month: d3.utcFormat('%b %Y')(date),
    year: `${d3.utcFormat('%b')(d3.utcMonth(this.grid.startDate))} &ndash; ${d3.utcFormat('%b %Y')(d3.timeMonth.offset(d3.utcMonth(this.grid.endDate), -1))}`,
  }[type];

  // get scores of the selected group
  const dataGroup = d3.map(this.active[this.data.getGroupKey[type]], (d) => d.date);
  let scores = dataGroup.get(this.time.formatDate(date));

  // update active tip data
  if (scores && scores.scores.length > 0) {
    scores = scores.scores;
    this.active.tip.scores = scores;
    this.active.tip.finalScores = scores.map((d) => ({
      player: d.player,
      score: d3.sum(d.scores),
    }));
    this.active.tip.nGames = scores[0].scores.length;
    this.active.tip.winner = getWinner(scores);
  }
};

RommeCal.clearTipData = function clearTipData() {
  Object.keys(this.active.tip).forEach((k) => { this.active.tip[k] = null; });
};

RommeCal.setUpSVG = function setUpSVG() {
  this.svg.g = d3.select(this.svg.selector)
    .append('svg')
    .attr('class', 'svg-content')
    .attr('viewBox', `0 0 ${this.svg.width} ${this.svg.height}`)
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .append('g')
    .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
};

RommeCal.drawGrid = function drawGrid() {
  const { cell } = this.grid;
  const x = (date) => d3.utcMonday.count(this.grid.startDate, date) * cell.size;

  // draw day cells
  this.svg.g.append('g')
    .selectAll(`.${cell.classDay}`)
    .data(this.grid.dates)
    .join('rect')
    .attr('class', cell.classDay)
    .attr('data-type', 'day')
    .attr('width', cell.size)
    .attr('height', cell.size)
    .attr('x', x)
    .attr('y', (date) => countDay(date) * cell.size);

  // draw week cells
  this.svg.g.append('g')
    .selectAll(`.${cell.classWeek}`)
    .data(this.grid.weeks)
    .join('rect')
    .attr('class', cell.classWeek)
    .attr('data-type', 'week')
    .attr('width', cell.size)
    .attr('height', cell.size)
    .attr('x', x)
    .attr('y', 7.5 * cell.size);

  // draw month cells
  this.svg.g.append('g')
    .selectAll(`.${cell.classMonth}`)
    .data(this.grid.months)
    .join('rect')
    .attr('class', cell.classMonth)
    .attr('data-type', 'month')
    .attr('width', (date) => countNumCells(date) * cell.size)
    .attr('height', cell.size)
    .attr('x', x)
    .attr('y', 9 * cell.size);

  this.getNumCells = function getNumCells() {
    const n = 7;
    const d = Math.max(0, Math.min(n, countDay(this.grid.endDate)));
    const w = d3.utcMonday.count(this.grid.startDate, this.grid.endDate);
    return d === 0 ? w : w + 1;
  };

  // draw overall cell
  this.svg.g.append('g')
    .selectAll(`.${cell.classYear}`)
    .data(this.grid.years)
    .join('rect')
    .attr('class', cell.classYear)
    .attr('data-type', 'year')
    .attr('width', this.getNumCells() * cell.size)
    .attr('height', cell.size)
    .attr('x', 0)
    .attr('y', 10.5 * cell.size);

  this.svg.g.selectAll('rect')
    .attr('fill', cell.fill)
    .attr('stroke', cell.stroke)
    .attr('stroke-width', cell.strokeWidth);

  this.grid.drawn = true;
};

RommeCal.drawMonthLines = function drawMonthLines() {
  this.pathMonth = function pathMonth(t) {
    const n = 7;
    const d = Math.max(0, Math.min(n, countDay(t)));
    const w = d3.utcMonday.count(this.grid.startDate, t);
    const s = this.grid.cell.size;

    if (d === 0) {
      return `M${w * s},0V${(n + 3) * s}`;
    }
    if (d === n) {
      return `M${(w + 1) * s},0V${(n + 3) * s}`;
    }
    return `M${(w + 1) * s},0V${d * s}H${w * s}V${(n + 3) * s}`;
  };

  const line = this.grid.monthLines;
  this.svg.g.append('g')
    .selectAll('.month')
    .data(d3.utcMonths(d3.utcMonth(this.grid.startDate), d3.utcMonth(this.grid.endDate)))
    .join('g')
    .attr('class', 'month')
    .filter((d, i) => i)
    .append('path')
    .attr('fill', line.fill)
    .attr('stroke', line.stroke)
    .attr('stroke-width', line.strokeWidth)
    .attr('d', (d) => this.pathMonth(d));
};

RommeCal.drawLabels = function drawLabels() {
  this.drawYear = function drawYear() {
    this.svg.g.append('text')
      .attr('class', 'label label-year')
      .attr('x', this.labels.xOffset)
      .attr('y', this.labels.yOffset)
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'end')
      .text('2020');
  };

  this.drawDays = function drawDays() {
    this.svg.g.append('g')
      .attr('text-anchor', 'end')
      .selectAll('.label-day')
      .data(d3.range(7).map((i) => new Date(1995, 0, i)))
      .join('text')
      .attr('class', 'label label-day')
      .attr('x', this.labels.xOffset)
      .attr('y', (d) => (countDay(d) + 0.5) * this.grid.cell.size)
      .attr('dy', '0.31em')
      .text((d) => this.labels.dayNames[d.getUTCDay()]);
  };

  this.drawMonths = function drawMonths() {
    this.svg.g.append('g')
      .selectAll('.label-month')
      .data(d3.utcMonths(d3.utcMonth(this.grid.startDate), d3.utcMonth(this.grid.endDate)))
      .join('text')
      .attr('class', 'label label-month')
      .attr('x', (d) => d3.utcMonday.count(this.grid.startDate, d3.utcMonday.ceil(d)) * this.grid.cell.size)
      .attr('y', this.labels.yOffset)
      .attr('font-weight', 'bold')
      .text(d3.utcFormat('%b'));
  };

  this.drawLeftLabels = function drawLeftLabels() {
    this.svg.g.selectAll('.label-left')
      .data([{
        text: 'Week',
        y: 8,
      }, {
        text: 'Month',
        y: 9.5,
      }, {
        text: 'All',
        y: 11,
      }])
      .join('text')
      .attr('class', 'label label-left')
      .attr('x', this.labels.xOffset)
      .attr('y', (d) => d.y * this.grid.cell.size)
      .attr('dy', '0.31em')
      .attr('text-anchor', 'end')
      .text((d) => d.text);
  };

  this.drawYear();
  this.drawDays();
  this.drawMonths();
  this.drawLeftLabels();
};

RommeCal.colorGrid = function colorGrid(transition = true) {
  const { cell } = this.grid;
  let cells = this.svg.g.selectAll('rect');

  if (transition) {
    cells = cells.transition()
      .duration(cell.colorTransitionDuration);
  }

  if (this.active.players.length < 1) {
    cells.attr('fill', cell.fill);
    return;
  }

  cells.attr('fill', (date, i, n) => {
    const type = d3.select(n[i]).attr('data-type');
    const scoresMap = d3.map(this.active[this.data.getGroupKey[type]], (d) => d.date);
    const scores = scoresMap.get(this.time.formatDate(date));
    return scores ? playerColors[getWinner(scores.scores)] : cell.fill;
  });
};

RommeCal.gridInteract = function gridInteract() {
  const { formatDate } = this.time;

  // init tooltip
  let tip = d3Tip()
    .attr('class', 'cell-tip')
    .html((date, elem) => createTipContent(date, elem, this.active.tip));
  this.svg.g.call(tip);

  this.svg.g.selectAll('rect')
    .on('mouseover', (date, i, n) => {
      const elem = d3.select(n[i]);
      this.active.tip.type = elem.attr('data-type');
      this.active.tip.date = date;

      if (this.active.tip.type !== 'year') {
        // all but the selected element
        let others = d3.selectAll('rect')
          .filter((_, j) => i !== j);

        // all but the selected week
        if (this.active.tip.type === 'week') {
          const xi = elem.attr('x');
          const wi = elem.attr('width');
          others = others.filter((d, j, m) => xi !== d3.select(m[j]).attr('x') || wi !== d3.select(m[j]).attr('width'));

          // all but the selected month
        } else if (this.active.tip.type === 'month') {
          others = others
            .filter((d) => formatDate(d3.utcMonth(d)) !== formatDate(d3.utcMonth(date)));
        }

        others.attr('fill-opacity', 0.5);
      }

      // show tip and draw chart within tip
      this.updateTipData();
      tip.show(date, n[i]);
      if (this.active.tip.scores) {
        tip = tip.attr('class', 'cell-tip cell-tip-large');
        this.drawChartInTip();
      }
    }).on('mouseout', (date, i) => {
      d3.selectAll('rect').filter((_, j) => i !== j).attr('fill-opacity', 1);

      // hide tip
      this.clearTipData();
      tip.hide();
      tip = tip.attr('class', 'cell-tip');
      this.clearChartInTip();
    });
};

RommeCal.drawChartInTip = function drawChartInTip() {
  const cfg = this.chartInTip;
  const scores = deepcopy(this.active.tip.scores);

  const width = cfg.width - cfg.margin.left - cfg.margin.right;
  const height = cfg.height - cfg.margin.top - cfg.margin.bottom;

  const svg = d3.select(cfg.selector)
    .append('svg')
    .attr('width', width + cfg.margin.left + cfg.margin.right)
    .attr('height', height + cfg.margin.top + cfg.margin.bottom)
    .append('g')
    .attr('transform', `translate(${cfg.margin.left}, ${cfg.margin.top})`);

  const players = scores.map((d) => d.player);
  const cumsumScores = scores.map((d) => {
    d.scores.unshift(0);
    return cumsum(d.scores);
  });

  const minScore = d3.min(cumsumScores.map((d) => d3.min(d)));
  const maxScore = d3.max(cumsumScores.map((d) => d3.max(d)));

  const xScale = d3.scaleLinear()
    .domain([0, this.active.tip.nGames])
    .range([0, width]);
  const yScale = d3.scaleLinear()
    .domain([minScore, maxScore])
    .nice()
    .range([height, 0]);
  const yTicks = yScale.ticks(4);

  const line = d3.line()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d))
    .curve(d3.curveStepBefore);

  // draw grid lines of the y-axis
  svg.selectAll('.y-axis-grid-lines')
    .data(yTicks)
    .join('line')
    .attr('class', 'y-axis-grid-lines')
    .attr('x1', 0)
    .attr('x2', width)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', (d) => (d === 0 ? 'gray' : 'lightgray'))
    .attr('stroke-width', 0.5)
    .attr('fill', 'none');

  // write y ticks
  svg.selectAll('.y-axis-grid-ticks')
    .data(yTicks)
    .join('text')
    .attr('class', 'y-axis-grid-ticks')
    .attr('x', -2)
    .attr('y', (d) => yScale(d))
    .attr('text-anchor', 'end')
    .attr('alignment-baseline', 'middle')
    .attr('fill', (d) => (d === 0 ? 'gray' : 'lightgray'))
    .text((d) => d);

  // draw cumulative scores line for each player
  svg.selectAll('path')
    .data(cumsumScores)
    .join('path')
    .attr('stroke', (_, i) => playerColors[players[i]])
    .attr('stroke-width', 1)
    .attr('fill', 'none')
    .attr('d', line);

  function getBaseline(rank) {
    const n = players.length;
    if (rank === 1) {
      return 'top';
    }
    if (rank === n) {
      return 'hanging';
    }
    return 'middle';
  }

  const finalScores = this.active.tip.finalScores
    .sort((a, b) => d3.descending(a.score, b.score))
    .map((d, i) => ({
      player: d.player,
      score: d.score,
      rank: i + 1,
    }));

  // write final score to the end of the line
  svg.selectAll('.text-score')
    .data(finalScores)
    .join('text')
    .attr('class', 'text-score')
    .attr('x', width + 2)
    .attr('y', (d) => yScale(d.score))
    .attr('alignment-baseline', (d) => getBaseline(d.rank))
    .attr('fill', (d) => playerColors[d.player])
    .attr('font-weight', 'bold')
    .text((d) => d.score);
};

RommeCal.clearChartInTip = function clearChartInTip() {
  d3.select(this.chartInTip.selector).selectAll('*').remove();
};

RommeCal.draw = function draw() {
  this.setUpSVG();

  this.drawGrid();
  this.colorGrid(false);
  this.drawMonthLines();
  this.gridInteract();

  this.drawLabels();
};

RommeCal.prepareData = function prepareData(data) {
  this.data.raw = data.filter((d) => d.date);

  this.data.scores = fold(this.data.raw);

  // group data into days / weeks / months / years
  this.data.groupKeys.forEach((key) => {
    const accessor = {
      dailyScores: (d) => this.time.parseDate(d.date),
      weeklyScores: (d) => d3.utcWeek.ceil(this.time.parseDate(d.date)),
      monthlyScores: (d) => d3.utcMonth(this.time.parseDate(d.date)),
      yearlyScores: (d) => d3.utcYear(this.time.parseDate(d.date)),
    }[key];

    this.data[key] = d3.nest()
      .key(accessor)
      .rollup(fold)
      .entries(this.data.raw)
      .map((d) => ({
        date: this.time.formatDate(new Date(d.key)),
        scores: d.value,
      }));
  });

  this.updatePlayers(this.players.init);
};

RommeCal.init = function init(selector) {
  this.svg.selector = selector;

  const filename = d3.select(selector).attr('data-src');
  d3.csv(filename, loadDatum).then((data) => {
    RommeCal.prepareData(data);
    RommeCal.draw();
  });
};
