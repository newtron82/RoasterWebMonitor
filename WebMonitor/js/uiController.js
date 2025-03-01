let sliderTimeout = null;

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

function initPage() {
    createContentHtml();
    loadScripts([
      'https://github.com/newtron82/RoasterWebMonitor/WebMonitor/js/chartManager.js', 
      'https://github.com/newtron82/RoasterWebMonitor/WebMonitor/js/roasterManager.js',
      'https://github.com/newtron82/RoasterWebMonitor/WebMonitor/js/websocketManager.js'
    ])
    .then(() => {
        initChart();
        initRoaster();
        initWebSocket();
    }).catch((error) => {
        console.error(error);
    });
}

function createContentHtml() {
    document.getElementById("content").innerHTML = `
    <div class="top">
      <div class="controller" id="tempContainer">
      </div>
    </div>
     <div class="monitor">
      <div class="chart" id="chartContainer">
      </div>
      <div class="values" id="valuesContainer">
      </div>
    </div>

    <div class="roasterControl">
      <button class="start" data-cmd="start">Start</button>
      <button class="charge" data-cmd="charge">Charge</button>
      <button class="filter" data-cmd="filter">Filter Fan</button>
      <button class="drum" data-cmd="drum">DRUM</button>
      <button class="drop" data-cmd="drop">Drop</button>
      <button class="cooling" data-cmd="cooling">Cooling</button>
    </div>`;
}

function createTempController() {
    document.getElementById("tempContainer").innerHTML = `
      <div class="controlsSliderGroup">
        <div class="sliderValue">
          <div class="sliderTitle">Heater:</div>
          <div>
            <button class="spinBtn" data-cmd="heater">-5</button>
            <button class="spinBtn" data-cmd="heater">-1</button>
            <input class="input value" data-cmd="heater" type="number" id="heaterInput" min="0" max="100" value="70">
            <button class="spinBtn" data-cmd="heater">+1</button>
            <button class="spinBtn" data-cmd="heater">+5</button>
          </div>
        </div>
        <input class="range" data-cmd="heater" type="range" id="heaterSlider" min="0" max="100" step="1" value="70">
      </div>

      <div class="controlsSliderGroup">
        <div class="sliderValue">
          <div class="sliderTitle">Fan:</div>
          <div>
            <button class="spinBtn" data-cmd="fan">-5</button>
            <button class="spinBtn" data-cmd="fan">-1</button>
            <input class="input value" data-cmd="fan" type="number" id="fanInput" min="0" max="100" value="40">
            <button class="spinBtn" data-cmd="fan">+1</button>
            <button class="spinBtn" data-cmd="fan">+5</button>
          </div>
        </div>
        <input class="range" data-cmd="fan" type="range" id="fanSlider" min="0" max="100" step="1" value="40">            
      </div>

      <div class="controlsSliderGroup">
        <div class="sliderValue">
          <div class="sliderTitle">Preheat:</div>        
          <div>
            <button class="spinBtn" data-cmd="preheat">-5</button>
            <button class="spinBtn" data-cmd="preheat">-1</button>
            <input class="input value" data-cmd="preheat" type="number" id="preheatInput" min="150" max="250" value="200">
            <button class="spinBtn" data-cmd="preheat">+1</button>
            <button class="spinBtn" data-cmd="preheat">+5</button>
          </div>
        </div>
        <input class="range" data-cmd="preheat" type="range" id="preheatSlider" min="150" max="250" step="1" value="200">
      </div>
    `;
    const controlsSliderGroup = document.querySelectorAll('.controlsSliderGroup');
    controlsSliderGroup.forEach(parent => {
      const spinners = parent.querySelectorAll('.spinBtn');
      const range = parent.querySelector('.range');
      const input = parent.querySelector('.input');
      range.value = LocalStorage.load(range.dataset.cmd, range.value);
      input.value = LocalStorage.load(input.dataset.cmd, input.value);

      spinners.forEach(spinBtn => {
      spinBtn.addEventListener('click', () => {
          const num = parseInt(spinBtn.textContent);
          range.value = parseInt(range.value) + num;
          input.value = parseInt(input.value) + num;
          LocalStorage.save(range.dataset.cmd, range.value);
        });
      });
    });

    roasterControlButton.forEach(button => { 
      button.classList.remove('on');
    });
    RoasterManager.init();

    const controlSlider = document.querySelectorAll('.range');
    const controlInput = document.querySelectorAll('.input');
    const roasterControlButton = document.querySelectorAll('.roasterControl button');

    controlSlider.forEach(range => range.addEventListener('input', roasterControlerEvent));
    controlInput.forEach(input => {
      input.addEventListener('input', roasterControlerEvent)
      input.addEventListener('blur', roasterControlerEvent)
    });

    roasterControlButton.forEach(button => { 
      button.addEventListener('click', () => {
        const isOn = button.classList.contains('on');

        if(button.dataset.cmd === 'start') {
          isStart = !isStart;
          if(isStart) {
            button.textContent = 'Stop';
            button.classList.replace('start', 'stop');
            roastingTime = 0;
            Object.keys(tempList).forEach((key, index) => {
              tempList[key] = [];
            });
            [tempChart, levelChart].forEach(chart => {
              chart.data.labels = [];
              chart.data.datasets.forEach(dataset => dataset.data = []);  
              chart.options.plugins.annotation.annotations = {};
              chart.update();
            });
            RoasterManager.init();
          }else {
            button.textContent = 'Start';
            button.classList.replace('stop', 'start');
          }          
        }else if(isOn) {
          button.classList.remove('on');
          sendDataRoaster(button.dataset.cmd, "0");
        }else {
          button.classList.add('on');
          sendDataRoaster(button.dataset.cmd, "100");
        }
      });
    });
  }

  const LocalStorage = {
    save: (key, value) => {
      localStorage.setItem(key, value);
    },
    load: (key, defaultValue) => {
      return localStorage.getItem(key) || defaultValue;
    }
  }
  
  function addData(time, ET, BT, heater, fan) {
    if(isStart) {
      timer.textContent = Util.integerToTimeFormat(roastingTime);
      
      RoastingProcess.checkPreheat(time, ET);

      const etROR = RoastingProcess.calculateROR(tempIdx.ET, time, ET);
      const btROR = RoastingProcess.calculateROR(tempIdx.BT, time, BT);

      RoasterManager.detectEvents(time, BT, btROR);

      // X축 max 값 업데이트 로직
      if (time > tempChartMax.time - 30) {
        tempChartMax.time = time + 30
        tempChart.options.scales.x.max = tempChartMax.time;
        levelChart.options.scales.x.max = tempChartMax.time;
      }
      
      const maxTemp = Math.max(ET, BT);
      if(maxTemp > tempChartMax.temp - 40) {
        tempChartMax.temp = maxTemp + 40;
        tempChart.options.scales.temp.max = Math.ceil(tempChartMax.temp);
      }
      
      const charge = RoasterManager.getCurrentState() >= RoasterManager.stateEnum.CHARGE;
      const dispEtRor = etROR < 0 || !charge ? 0 : etROR;
      const dispBtRor = btROR < 0 || !charge ? 0 : btROR;

      if(RoasterManager.getCurrentState() > RoasterManager.stateEnum.CHARGE) {
        const maxROR = Math.max(dispEtRor, dispBtRor);
        if(maxROR > 100 && maxROR > tempChartMax.ror - 10) {
          tempChartMax.ror = maxROR + 10;
          tempChart.options.scales.ror.max = Math.round(tempChartMax.ror);
        }
      }

      tempChart.data.labels.push(roastingTime);
      tempChart.data.datasets[tempIdx.ET].data.push(ET); // ET
      tempChart.data.datasets[tempIdx.BT].data.push(BT); // BT
      tempChart.data.datasets[tempIdx.rorET].data.push(dispEtRor); // ET ROR
      tempChart.data.datasets[tempIdx.rorBT].data.push(dispBtRor); // BT ROR

      levelChart.data.labels.push(roastingTime);
      levelChart.data.datasets[levelIdx.HEATER].data.push(heater); // Heater Level
      levelChart.data.datasets[levelIdx.FAN].data.push(fan); // Fan Level

      levelChart.update();
      tempChart.update();

      document.getElementById('etRor').textContent = dispEtRor.toFixed(0);
      document.getElementById('btRor').textContent = dispBtRor.toFixed(0);
    }

    document.getElementById('et').textContent = ET.toFixed(0);
    document.getElementById('bt').textContent = BT.toFixed(0);
    document.getElementById('heater').textContent = heater.toFixed(0);
    document.getElementById('fan').textContent = fan.toFixed(0);
 
    roastingTime++;
  }

  document.addEventListener("DOMContentLoaded", initPage);