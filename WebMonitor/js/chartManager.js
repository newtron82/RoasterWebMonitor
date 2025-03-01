let tempCtx;
let levelCtx;
let tempChart;
let levelChart;

const tempIdx = { ET:0, BT:1, rorET:2, rorBT:3 }
const levelIdx = { HEATER:0, FAN:1 }
const tempList = {et:[],bt:[]};
let tempChartMax = {time:480, temp:260, ror:50};

const ChartUtil = {
    tooltipTitleFormat(tooltipItems) {
      const value = tooltipItems[0].parsed.x; // x 값 가져오기
      return Util.integerToTimeFormat(value);
    },
    updateXAxis(chargeTime) {
      const startTime = chargeTime - 10;

      // tempChart와 levelChart 데이터 필터링
      const chartTargetIndex = tempChart.data.labels.indexOf(startTime);
      [tempChart, levelChart].forEach(chart => {
        chart.data.labels = chart.data.labels.filter((label, index) => index >= chartTargetIndex);

        chart.data.datasets.forEach(dataset => {
          dataset.data = dataset.data.filter((data, index) => index >= chartTargetIndex);
        });
      });

      // X축의 최소값을 -10으로 재설정
      tempChart.options.scales.x.min = -10;25
      tempChart.options.scales.x.max = tempChartMax.time;
      levelChart.options.scales.x.min = -10;
      levelChart.options.scales.x.max = tempChartMax.time;

      // X축의 라벨 업데이트 (-5초부터 다시 그리기)
      tempChart.data.labels = tempChart.data.labels.map(label => label - chargeTime);
      levelChart.data.labels = levelChart.data.labels.map(label => label - chargeTime);
      Object.keys(tempList).forEach((key, index) => {
        tempList[key] = tempList[key]
          .filter(data => data.time >= startTime) // chargeTime - 10 이후 데이터만 필터링
          .map(data => ({
            ...data,
            time: data.time - chargeTime // time을 chargeTime 기준으로 조정
           })
        );
      });
      roastingTime = tempChart.data.labels[tempChart.data.labels.length-1]+1;
    },
    // 배경 색상을 추가할 함수
    addBackgroundRegion(startX, color, id) {
      const backgroundRegion = {
        type: 'box',
        xMin: startX,
        xMax: startX,
        backgroundColor: color,
        borderWidth: 0,
      }
      tempChart.options.plugins.annotation.annotations[id] = backgroundRegion;
      levelChart.options.plugins.annotation.annotations[id] = backgroundRegion;
    },
    updateBackgroundRegion(endX, id) {
      if(tempChart.options.plugins.annotation.annotations[id] != undefined) {
        [tempChart, levelChart].forEach(chart => {
          chart.options.plugins.annotation.annotations[id].xMax = endX;
        });
      }
    },
    // 차트를 가져오는 함수
    getChart(chartType) {
      return chartType.split('-')[0] === "tempChart" ? tempChart : levelChart;
    },
    
    getChartDataset(tag) {
      const [chartType, idx] = tag.split('-');
      const chart = this.getChart(chartType);
      return chart.data.datasets[idx]
    },

    // 차트 스타일 초기화 함수
    resetChartStyles() {
      [tempChart, levelChart].forEach(chart => {
        chart.data.datasets.forEach(dataset => (dataset.borderWidth = 1));
        chart.update();
      });
    },
    // 차트 스타일 초기화 함수
    updateChartStyles() {
      const activeTags = [...document.querySelectorAll('.values div[data-active="true"]')]
      .map((el) => el.dataset.tag);

      this.resetChartStyles();

      activeTags.forEach((tag) => {
        this.getChartDataset(tag).borderWidth = 4;
      });

      tempChart.update();
      levelChart.update();
    },
  }

  const ChartData = {
    createChartDataset: function(id, label, color, yAxisID, chartType, unit) {
      return {
        id: id,
        label: label,
        unit: unit,
        chartType: chartType,
        data: [],
        borderColor: color,
        borderWidth: 1,
        yAxisID: yAxisID,
        pointRadius: 0,
        tension: 0.1,
      }
    },
    levelData: function() {
      return {
        labels: [],
        datasets: [
          this.createChartDataset('heater', 'Heater', 'red', 'level', 'levelChart', '%'),
          this.createChartDataset('fan', 'Fan', 'purple', 'level', 'levelChart', '%'),
        ],
      }
    },
    tempData: function() {
      return {
        labels: [],
        datasets: [
          this.createChartDataset('et', 'ET', 'red', 'temp', 'tempChart', '°C'),
          this.createChartDataset('bt', 'BT', 'blue', 'temp', 'tempChart', '°C'),
          this.createChartDataset('etRor', 'ΔET', 'pink', 'ror', 'tempChart', '°C/min'),
          this.createChartDataset('btRor', 'ΔBT', 'green', 'ror', 'tempChart', '°C/min'),
        ],
      }
    },
  }

  const ChartOptions = {
    baseOptions: {
      maintainAspectRatio: false,
      animations: {
        y: {duration: 0}, x: {duration : 0}
      },
      responsive: true,
      plugins: {
        //  annotation: {
        //   annotations: {}, // Annotation 데이터를 여기에 추가
        //  },
        tooltip: { 
          callbacks: { 
            title:  tooltipItems => {
              let time = tooltipItems[0].parsed.x;
              return Util.integerToTimeFormat(time);
            }
          }, 
        },
      },
      hover: {
        mode: 'nearest', // 마우스 근처 데이터만 반응
        intersect: true, // 마우스가 선과 교차할 때만 반응
      }, 
      onHover: (event, elements, chart) => chartEvent.onHover(event, elements, chart),
      onClick: (event, elements, chart) => chartEvent.onClick(event, elements, chart),
    },
    xScaleBase: {
      type: 'linear',
          position: 'bottom',
          // title: {
          //   display: true,
          //   text: 'Time (seconds)',
          // },
          ticks: {
            stepSize: 10, 
            callback: value => { 
              let time = value;
              return Util.integerToTimeFormat(time);
            },
          },
          min : -10,
          max : tempChartMax.time,
    },
    levelOptions: function() {
      return {
        ...this.baseOptions,
        scales: {
          x: {
            ...this.xScaleBase,
            title: {
              display: true,
              text: 'Time (seconds)',
            },
          },
          level: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Rate/Level (%)',
            },
            min: 0,
            max: 100,
          },
          hidden: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: ' ',
            },
            min: 0,
            max: 100,
          },
        },
          plugins: {
            ...this.baseOptions.plugins,
            legend: {
              display: false,
              position: 'bottom',
          },
        },
      };
    },
    tempOptions: function() {
      return {
        ...this.baseOptions,
        scales: {
          x: {
            ...this.xScaleBase,
            title: {
              display: false,
              text: 'Time (seconds)',
            },
          },
          temp: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Temperature (°C)' },
            min: 0,
            max: tempChartMax.temp,
            grid: {
              drawOnChartArea: false,
            },
          },
          ror: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: '°C/min' },
            min: 0,
            max: 100,
            grid: {
              drawOnChartArea: true,
            },
          },
        },
        plugins: {
          ...this.baseOptions.plugins,
          legend: {
            display: false,
            position: 'top',
          },
        },
      };
    },
  }

  const ChartConfig = {
    baseConfig: {
      type: 'line',
      resize: {
        duration: 700, // 리사이즈 애니메이션 시간
        easing: 'easeOutElastic' // 리사이즈 시 애니메이션 효과
      },
    },
    levelConfig: function() {
      return {
        ...this.baseConfig,
        data: ChartData.levelData(),
        options: ChartOptions.levelOptions(),
      }
    },
    tempConfig: function() {
      return {
        ...this.baseConfig,
        data: ChartData.tempData(),
        options: ChartOptions.tempOptions(),
      }
    }
  }

  const RoastingChart = {
    init: function() {
      tempChart.data.labels = []; // 초기화
      tempChart.data.datasets.forEach(dataset => (dataset.data = []));
      levelChart.data.labels = []; // 초기화
      levelChart.data.datasets.forEach(dataset => (dataset.data = []));
    }
  }

  const Util = {
    integerToTimeFormat: (value) => {
      const calValue = value>=0?value:-value;
      // 초를 mm:ss 형식으로 변환
      const minutes = Math.floor(calValue / 60);
      const seconds = Math.floor(calValue % 60);
      return `${value<0?'-':''}${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // time 값을 기준으로 차트 영역 내에서 start, center, end로 위치 조정
  function adjustXPosition(tempCtx, time) {
    const chart = tempCtx.chart;
    const xMin = chart.scales.x.min;
    const xMax = chart.scales.x.max;
  
    if (time <= xMin + (xMax - xMin) * 0.1) {
      return 'start'; // 차트 시작 부분에 가까울 때
    } else if (time >= xMax - (xMax - xMin) * 0.1) {
      return 'end'; // 차트 끝부분에 가까울 때
    } else {
      return 'center'; // 차트 중앙
    }
  }
  
  const ChartAannotationManager = {
    getTagKeys: function() {
      const chart = tempChart;
      const annotations = chart.options.plugins.annotation.annotations;
      return Object.keys(annotations).filter(key => key.startsWith('tag-'));
    },
    getAnnotationCount: function() {
      return this.getTagKeys().length;
    },
    getKeyIndex: function(annotationId) {
      return this.getTagKeys().indexOf(annotationId);
    },
    getAnnotationLabelPos: function(currentId) {
      const ctx = tempChart.ctx;
      const chart = tempChart;
      const annotations = chart.options.plugins.annotation.annotations;

      const annotation = annotations[currentId];
      const xStart = chart.scales.x.getPixelForValue(annotation.xValue);
      const yStart = chart.scales.temp.getPixelForValue(annotation.yValue);

      const textWidths = annotation.content.map((line) => ctx.measureText(line).width);
      const labelWidth = Math.max(...textWidths);
      
      const padding = annotation.padding || 5;
      const textHeight = annotation.font.size;
      const labelHeight = textHeight  * annotation.content.length; 

      const xEnd = xStart+labelWidth + padding * 2;
      const yEnd = yStart+labelHeight + padding * 2;
    
      return {position:{x1:xStart,y1:yStart, x2:xEnd, y2:yEnd}, size:{width:labelWidth,height:labelHeight}}
    },
    // 이전 annotation 의 위치와 크기
    getBeforeAnnotationLabelPos: function(currentId) {
      const keys = this.getTagKeys();

      if(keys.length > 1) {
        const currentIdx = keys.indexOf(currentId);
        if(currentIdx < 1)
          return null;
        const beforeKey = keys[currentIdx-1];

        return this.getAnnotationLabelPos(beforeKey);
      }
      return null;
    },
    // time 값에 따라 x 축 조정을 추가하여 주석이 차트 영역 안에 있도록 설정
    adjustXOffset: function(tempCtx, time, annotationId) {
      const chart = tempCtx.chart;
      const xMin = chart.scales.x.min;
      const xMax = chart.scales.x.max;

      const currAnnotationPos = this.getAnnotationLabelPos(annotationId);
      const beforeAnnotationPos = this.getBeforeAnnotationLabelPos(annotationId);
      const xStartPos = currAnnotationPos.position.x1;
      const xEndPos = currAnnotationPos.position.x1;
      
      if(annotationId === 'tag-charge') {
        return 10;
      }else if(beforeAnnotationPos != null) {
        const beforeAnnotationXend = beforeAnnotationPos.position.x2;
        const currWidth = currAnnotationPos.size.width;
        const gap = beforeAnnotationXend - xStartPos;
        if(gap < -currWidth) {
          return -currWidth;
        }else if(beforeAnnotationXend >= xStartPos) {
          return gap+10;
        }
      }else if(xStartPos <= xMin) {
        return xMin - xStartPos + 10;
      }else if(xEndPos >= xMax) {
        return xMax - xEndPos;
      }else {
        return 0;
      }
    },
    adjustYOffset: function(tempCtx, value) {
      const chart = tempCtx.chart;
      const yMax = chart.scales.temp.max;
      return -(yMax-value);
    },
    adjustYPosition: function(tempCtx, value) {
      const chart = tempCtx.chart;
      const yMin = chart.scales.temp.min;
      const yMax = chart.scales.temp.max;
      // Y축 값이 최소값보다 작으면 최소값 근처로 이동
      if (value <= yMin + 5) {
        return yMin + 5;
      }
      // Y축 값이 최대값보다 크면 최대값 근처로 이동
      if (value >= yMax - 5) {
        return yMax - 5;
      }
      return value+10; // 값이 범위 내에 있으면 그대로 사용
    },
    autoScaling: function(ctx, option, origValue) {
      const {chart} = ctx;
      const {width, height} = chart.chartArea;
      const hypo = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
      let size, value;
      if (!ctx.size) {
        ctx.size = size = hypo;
        value = origValue;
      } else {
        size = ctx.size;
        value = hypo / size * origValue;
      }
      if (option === 'font') {
        return {size: value};
      }
      return value;
    },
    addVerticalLine: function(chart, xValue, label, color, id) {
      // Annotation 추가
      chart.options.plugins.annotation.annotations[id] = {
        type: 'line',
        xMin: xValue, // 세로선의 x값
        xMax: xValue, // 세로선의 x값 (xMin과 동일)
        borderColor: color, // 선 색상
        borderWidth: 0.5, // 선 굵기
        borderDash: [4, 6],
        borderRadius: 2,
        label: {
          display: false, // 라벨 표시
          content: label, // 라벨 내용
          position: 'end', // 라벨 위치 (start, center, end)
          backgroundColor: color,
          color: 'white',
          font: {
            size: 10,
            weight: 'normal',
          },
          padding: 2,
        },
      };

      // 차트 업데이트
      chart.update();
    },
    addTag: function(tagId, time, value, text, color) {
      // Annotation 추가
      const annotationId = `tag-${tagId}`;
      tempChart.options.plugins.annotation.annotations[annotationId] = {
        type: 'label',
        backgroundColor: color,
        callout: {
          display: true,
          borderColor: color,
          borderDash: [7, 3],
          margin: 0,
        },
        borderRadius: 3,
        content: (tempCtx) => text,
        color: 'white',
        font: (tempCtx) => this.autoScaling(tempCtx, 'font', 10),
        padding: (tempCtx) => this.autoScaling(tempCtx, 'padding', 3),
        xValue: (tempCtx) => time,
        yValue: (tempCtx) => value,
        xAdjust: (tempCtx) => this.adjustXOffset(tempCtx, time, annotationId),
        yAdjust: (tempCtx) => this.adjustYOffset(tempCtx, value),
      };
      this.addVerticalLine(tempChart, time, text, color, tagId);
      this.addVerticalLine(levelChart, time, text, color, tagId);
      tempChart.update();
    }
  }

  const chartEvent = {
    onHover(event, elements, chart) {
        if (elements.length) {
          this.chartHover(chart.canvas.id, elements[0].datasetIndex);
        } else {
          ChartUtil.updateChartStyles();
        }
    },
    onClick(event, elements, chart) {
      if (elements.length) {
        this.chartClick(chart.canvas.id, elements[0].datasetIndex);
      } else {
        ChartUtil.updateChartStyles();
      }
    },
    // 차트 Hover 핸들러
    chartHover(chartType, idx) {
      const tag = `${chartType}-${idx}`;
      document.querySelectorAll('.values div').forEach((el) => {
        if(el.getAttribute('data-tag') == tag) {
          return this.handleHover(el);
        }
      });
    },
    // 차트 클릭 핸들러
    chartClick(chartType, idx) {
      const tag = `${chartType}-${idx}`;
      document.querySelectorAll('.values div').forEach((el) => {
        if(el.getAttribute('data-tag') == tag) {
          return this.handleClick(el);
        }
      });
    },
    // Hover 핸들러
    handleHover(div) {
      const tag = div.getAttribute('data-tag');
      ChartUtil.getChartDataset(tag).borderWidth = 3;
      ChartUtil.getChart(tag).update();
    },
    // 클릭 핸들러
    handleClick(div) {
      const activeDiv = div.getAttribute('data-active') == 'true';
      // 모든 항목의 클릭 상태 초기화
      document.querySelectorAll('.values div').forEach((el) => {
        el.setAttribute('data-active', 'false');
      });

      // 현재 항목을 클릭된 상태로 설정
      if(!activeDiv) {
        div.setAttribute('data-active', 'true');
      }
      ChartUtil.updateChartStyles();
    },
    // 더블클릭
    dblClick(div) {
      console.log(`${JSON.stringify(div.classList)} : ${div.textContent} : ${div.dataset.tag}`);
      const chartDataset = ChartUtil.getChartDataset(div.dataset.tag);
      chartDataset.hidden = !chartDataset.hidden;
      ChartUtil.getChart(div.dataset.tag).update();
    }
  }

function createChartHtml() {
    document.getElementById("chartContainer").innerHTML = `
        <div class="chart-container chart-top">
            <canvas id="tempChart" />
        </div>
        <div class="chart-container chart-bottom">
            <canvas id="levelChart" />
        </div>`;
    
    tempCtx = document.getElementById('tempChart').getContext('2d');
    levelCtx = document.getElementById('levelChart').getContext('2d');
    tempChart = new Chart(tempCtx, ChartConfig.tempConfig());
    levelChart = new Chart(levelCtx, ChartConfig.levelConfig());

    [ChartData.tempData().datasets, ChartData.levelData().datasets].forEach((datasets) => { 
        datasets.forEach((item, datasetIndex) => {
            const div = document.createElement('div');
            div.className = item.id;
            div.style.backgroundColor = item.borderColor;
            div.setAttribute('data-active', false); // 클릭 상태를 저장하는 속성 추가
            if(datasetIndex >= ChartData.tempData().datasets.length) {
            datasetIndex -= ChartData.tempData().datasets;
            }
            div.setAttribute('data-tag', `${item.chartType}-${datasetIndex}`);
            div.innerHTML = `${item.label}<br/><span id="${item.id}">-</span><span class="unit"> ${item.unit}</span>`;
            valuesContainer.appendChild(div);

            // 이벤트 리스너 추가
            div.addEventListener('mouseover', () => chartEvent.handleHover(div));
            div.addEventListener('mouseout', () => ChartUtil.updateChartStyles());
            div.addEventListener('click', () => chartEvent.handleClick(div));
            div.addEventListener('dblclick', () => chartEvent.dblClick(div));
        });
    });
}

function loadScripts(scripts) {
    return Promise.all(scripts.map(src => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
        resolve(); // 이미 로드된 경우 스킵
        return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.onload = () => {
            resolve();
        };
        script.onerror = () => reject(new Error(`${src} 로드 실패`));
        document.head.appendChild(script);
    })));
}

async function loadChartJS() {
    try {
      await loadScripts(["https://cdn.jsdelivr.net/npm/chart.js"]);
      await loadScripts(["https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation"]);
    } catch (error) {
      console.error("스크립트 로드 실패:", error);
    }
  }

function initChart() {
    loadChartJS().then(() => {
        createChartHtml();
    });
}