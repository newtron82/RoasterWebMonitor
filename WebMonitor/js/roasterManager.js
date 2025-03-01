let timer;

function initRoaster() {
    const timerDiv = document.createElement("div");
    timerDiv.id = "timer";
    timerDiv.textContent = "00:00";
    document.getElementById('header').prepend(timerDiv);
    timer = document.getElementById('timer');
}

// 설정 변수
let targetTemperature = 200; // 설정 온도

const RoasterManager = {
  roastingEvents: new Map(),

  stateEnum: {
    IDLE: 0,
    PREHEAT: 1,
    CHARGE: 2,
    TURNING_POINT: 3,
    FIRST_CRACK_START: 4,
    FIRST_CRACK_END: 5,
    SECOND_CRACK_START: 6,
    SECOND_CRACK_END: 7,
    DROP: 8,
    END: 9,
  },

  init: function () {
    const fan = document.getElementById('fanInput').value;
    const heater = document.getElementById('heaterInput').value;
    console.log(`fan : ${fan}, heater : ${heater}`);
    sendDataRoaster('fan', fan);
    sendDataRoaster('heater', heater);
    this.roastingEvents.clear();
    this.addEvent(0, 0, this.stateEnum.IDLE);
  },

  addEvent: function (time, temperature, state) {
    const event = { time, temperature, state };
    this.roastingEvents.set(state, event);
  },

  getCurrentState: function (step = 0) {
    if (this.roastingEvents.size === 0 || this.roastingEvents.size < this.roastingEvents.size - step) {
      return { time: 0, temperature: 0, state: this.stateEnum.IDLE };
    }

    const keys = Array.from(this.roastingEvents.keys());
    const currentState = keys[keys.length - 1 - step];
    return this.roastingEvents.get(currentState).state;
  },

  getEventByState: function (state) {
    return this.roastingEvents.get(state) || null;
  },

  clearEvent: function () {
    this.roastingEvents.clear();
  },

  eventAction: {
    charge: function(time, temp) {
      ChartUtil.updateXAxis(time);
      RoasterManager.addEvent(0, temp, RoasterManager.stateEnum.CHARGE);
      ChartAannotationManager.addTag('charge', roastingTime, temp, [`CH ${Util.integerToTimeFormat(0)}`, `${temp.toFixed(1)}°C`], 'brown', 0);
      notification.classList.remove('show');
    },

    tp: (time, temp) => {
      RoasterManager.addEvent(time, temp, RoasterManager.stateEnum.TURNING_POINT);
      ChartAannotationManager.addTag('tp', time, temp, [`TP ${Util.integerToTimeFormat(time)}`, `${temp.toFixed(1)}°C`], 'blue');
    },

    fcs: (time, temp) => {
      console.log(`fcs : ${time}/${temp}`);
      RoasterManager.addEvent(time, temp, RoasterManager.stateEnum.FIRST_CRACK_START);
      ChartAannotationManager.addTag('fcs', time, temp, [`FCs ${Util.integerToTimeFormat(time)}`, `${temp.toFixed(1)}°C`], 'green');
      ChartUtil.addBackgroundRegion(time, 'rgba(0, 255, 0, 0.1)', 'fcs-region');
    },

    fce: (time, temp) => {
      RoasterManager.addEvent(time, temp, RoasterManager.stateEnum.FIRST_CRACK_END);
      ChartAannotationManager.addTag('fce', time, temp, [`FCe ${Util.integerToTimeFormat(time)}`, `${temp.toFixed(1)}°C`], 'green');
      ChartUtil.updateBackgroundRegion(time, 'fcs-region');
    },

    scs: (time, temp) => {
      RoasterManager.addEvent(time, temp, RoasterManager.stateEnum.SECOND_CRACK_START);
      ChartAannotationManager.addTag('scs', time, temp, [`SCs ${Util.integerToTimeFormat(time)}`, `${temp.toFixed(1)}°C`], 'red');
      ChartUtil.addBackgroundRegion(time, 'rgba(255, 0, 0, 0.1)', 'scs-region');
    },

    sce: (time, temp) => {
      RoasterManager.addEvent(time, temp, RoasterManager.stateEnum.SECOND_CRACK_END);
      ChartAannotationManager.addTag('sce', time, temp, [`SCe ${Util.integerToTimeFormat(time)}`, `${temp.toFixed(1)}°C`], 'red');
      ChartUtil.updateBackgroundRegion(time, 'scs-region');
    },

    drop: (time, temp) => {
      RoasterManager.addEvent(time, temp, RoasterManager.stateEnum.DROP);
      if (RoasterManager.getCurrentState(1) === RoasterManager.stateEnum.FIRST_CRACK_START) {
        ChartUtil.updateBackgroundRegion(time, 'fcs-region');
      } else if (RoasterManager.getCurrentState(1) === RoasterManager.stateEnum.SECOND_CRACK_START) {
        ChartUtil.updateBackgroundRegion(time, 'scs-region');
      }
      ChartAannotationManager.addTag('drop', time, temp, [`DROP ${Util.integerToTimeFormat(time)}`, `${temp.toFixed(1)}°C`], 'orange');
    },
  },

  btList: function() {
    return tempList.bt.filter(bt => bt.time >= this.getEventByState(this.getCurrentState()).time);
  },

  deltaList: function() {
    // ΔROR(1초 단위 ROR 변화) 계산
    const btList = this.btList()
    return btList
          .map((_, i) =>
              i > 0 ? btList[i].ror - btList[i - 1].ror : 0
          );
  },

  eventDefinitions: [
    {
      // Charge : BT 값이 급격하고 떨어지기 시작하는 시점
      condition: function (time, BT, ROR) {
        if(this.getCurrentState() < this.stateEnum.CHARGE) {
          const btList = tempList.bt;
          const rorTime = 5;
          
          for (let i = rorTime; i < btList.length-rorTime; i++) {
            const rorBefore = btList.slice(i - rorTime, i).map(bt => bt.ror);
            const rorAfter = btList.slice(i+1, i + rorTime).map(bt => bt.ror);
            const allBeforePositive = rorBefore.every(ror => ror >= 0);
            const allAfterNegative = rorAfter.every(ror => ror < -1);
            if(allBeforePositive && allAfterNegative) {
              this.eventAction.charge(btList[i].time, btList[i].temp);
              return true;
            }
          }
        }
        return false;
      }
    },
    {
      // TP : BT 값이 최저점을 찍고 상승하기 시작하는 시점
      condition: function (time, BT, currentROR) {
        if (this.getCurrentState() === this.stateEnum.CHARGE && currentROR > 0) {
          const btList = this.btList();
          const rorTime = 6;
          if (btList.length > rorTime) {
            const chargeBT = this.getEventByState(this.stateEnum.CHARGE);
            for (let i = 3; i < btList.length-rorTime; i++) {
              if(chargeBT.temperature - btList[i].temp > 10) {
                const rorBefore = btList.slice(3, i-1).map(bt => bt.ror);
                const rorAfter = btList.slice(i+1, i + rorTime).map(bt => bt.ror);
                const allBeforeNegative = rorBefore.every(ror => ror <= 0);
                const allAfterPositive = rorAfter.every(ror => ror > 0);
                if(allBeforeNegative && allAfterPositive) {
                  this.eventAction.tp(btList[i].time, btList[i].temp);
                  return true;
                }
              }
            }
          }
        }
        return false;
      }
    },
    {
      // First Crack Start :
      // BT > 190°C 및 BT < 205°C
      // ΔROR 값이 급격히 감소하다가 완만해지는 시점
      // ROR 값이 1차 크랙 시작을 나타내는 범위(예: 10~20°C/min)에서 변동
      condition: function (time, BT, ROR) {
        if(this.getCurrentState() === this.stateEnum.TURNING_POINT) {
          const btList = this.btList();
          const deltaROR = this.deltaList()
          const lll = 20;
          for (let i = 1; i < btList.length-lll; i++) {
            const currDeltaRor = deltaROR[i];
            const prevDeltaRor = deltaROR[i - 1];
            // ΔROR 감소폭이 완만해지는 시점
            if(currDeltaRor > -2 && prevDeltaRor < -2) {
              if(195 <= btList[i].temp && btList[i].temp <= 205) {
                this.eventAction.fcs(btList[i].time, btList[i].temp);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
    {
      // First Crack End : 
      // BT > 205°C 및 BT < 215°C
      // ΔROR 값이 다시 급격히 하락하는 시점
      // ROR 값이 안정화되었다가 다시 감소 시작
      condition: function (time, BT, ROR) {
        if(this.getCurrentState() === this.stateEnum.FIRST_CRACK_START) {
          const btList = this.btList();
          const deltaROR = this.deltaList()
          for (let i = 1; i < btList.length; i++) {
            const deltaRor = deltaROR[i];
            const ror = btList[i].ror;
            // ΔROR이 다시 급격히 감소, ROR 값이 10°C/min 이하
            if(deltaRor < -2 && ror < 10 ) {
              if(205 <= btList[i].temp && btList[i].temp <= 220) {
                this.eventAction.fce(btList[i].time, btList[i].temp);
                return true;
              }
            }
          }
        }
        return false;
      }
    },
    {
      // Second Crack Start :
      // BT > 220°C 및 BT < 230°C
      // ΔROR 값이 평탄화되거나 완만한 감소
      // ROR 값이 특정 범위(예: 5~10°C/min)에 도달
      condition: function (time, BT, ROR) {
        if(this.getCurrentState() === this.stateEnum.FIRST_CRACK_END) {
          const btList = this.btList();
          const deltaROR = this.deltaList()
          for (let i = 1; i < btList.length; i++) {
            const deltaRor = deltaROR[i];
            const ror = btList[i].ror;
            // ΔROR이 평탄화되는 구간, ROR 값: 5~10°C/min
            if(deltaRor >= -1 && deltaRor <= 1
             && ror >= 5 && ror <= 10 ) {
              if(220 <= btList[i].temp && btList[i].temp <= 230) {
                this.eventAction.scs(btList[i].time, btList[i].temp);
                return true;
              }
            }
          }
        }
        return false;
      }
    },
    {
      // Second Crack End : 
      // BT > 230°C 및 BT < 240°C
      // ΔROR 값이 다시 급격히 감소
      // ROR 값이 최저점(예: 2~5°C/min)으로 도달
      condition: function (time, BT, ROR) {
        if(this.getCurrentState() === this.stateEnum.SECOND_CRACK_START) {
          const btList = this.btList();
          const deltaROR = this.deltaList()
          for (let i = 1; i < btList.length; i++) {
            const deltaRor = deltaROR[i];
            const ror = btList[i].ror;
            // ΔROR이 급격히 하락, ROR 값이 5°C/min 이하
            if(deltaRor < -2 && ror < 5 ) {
              if(230 <= btList[i].temp) {
                this.eventAction.sce(btList[i].time, btList[i].temp);
                return true;
              }
            }
          }
        }
        return false;
      }
    },
    {
      // Drop :
      // ROR 값이 안정화되고 ΔROR이 거의 0에 가까운 상태
      // BT가 목표 배출 온도(예: 225~240°C)에 도달
      condition: function (time, BT, ROR) {
        if(this.getCurrentState() > this.stateEnum.TURNING_POINT && this.getCurrentState() < this.stateEnum.DROP) {
          const btList = this.btList();
          const rorTime = 5;
          
          for (let i = rorTime; i < btList.length-rorTime; i++) {
            const rorBefore = btList.slice(i - rorTime, i).map(bt => bt.ror);
            const rorAfter = btList.slice(i+1, i + rorTime).map(bt => bt.ror);
            const allBeforePositive = rorBefore.every(ror => ror >= 0);
            const allAfterNegative = rorAfter.every(ror => ror <= 0);
            if(allBeforePositive && allAfterNegative) {
              this.eventAction.drop(btList[i].time, btList[i].temp);
              return true;
            }
          }
        }
        return false;
      }
    },
  ],

  detectEvents: function (time, BT, ROR) {
    const startIdx = this.getCurrentState() < this.stateEnum.CHARGE?0:this.getCurrentState()-1;
    for(let i=startIdx; i < this.eventDefinitions.length; i++) {
      const condition = this.eventDefinitions[i].condition;
      if (condition.call(this, time, BT, ROR)) {
        break;
      }
    }
  },
};


function roasterControlerEvent(event) {
    const target = event.target;
    const parent = target.closest('.controlsSliderGroup');
    const range = parent.querySelector('.range');
    const input = parent.querySelector('.input');

    const min = parseInt(range.min); // min 속성 값 가져오기
    const max = parseInt(range.max); // max 속성 값 가져오기

    clearTimeout(sliderTimeout);
    if(target.classList.contains('range')) {
      input.value = range.value;
      LocalStorage.save(range.dataset.cmd, range.value);
      if(range.dataset.cmd != 'preheat') {
        sliderTimeout = setTimeout(() => {
          sendDataRoaster(range.dataset.cmd, input.value);
        }, 200);
      }
    }else if(target.classList.contains('input')) {
      const value = input.value;
      LocalStorage.save(input.dataset.cmd, range.value);
      if(event.type === 'input') {
        sliderTimeout = setTimeout(() => {
          const newTargetTemperature = parseInt(value);
          if (!isNaN(newTargetTemperature) && newTargetTemperature >= min && newTargetTemperature <= max) {
            targetTemperature = newTargetTemperature;
            range.value = targetTemperature; // 슬라이더와 동기화
            sendDataRoaster(range.dataset.cmd, input.value);
          }else if (!isNaN(newTargetTemperature)) {
            if(newTargetTemperature < min ) {
              input.value = min;
            }else if(newTargetTemperature > max ) {
              input.value = max;
            }
          }
        }, 300);
      }else if(event.type === 'blur') {
        if (isNaN(parseInt(input.value))) {
          input.value = range.value;
        }
      }
    }
  }

  // 사용자 정의 알림 표시 함수
  function showNotification(message) {
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
      notification.classList.remove('show');
    }, 10000); // 10초 후 알림 숨기기
  }

  const RoastingProcess = {
    // 예열 상태 감지
    checkPreheat: function(time, currentTemperature) {
      if (RoasterManager.getCurrentState() < RoasterManager.stateEnum.CHARGE && currentTemperature >= targetTemperature) {
        showNotification("예열이 완료되었습니다!");
        RoasterManager.addEvent(time, currentTemperature, RoasterManager.stateEnum.PREHEAT);
        // alertSound.play(); // 알림음 재생
      }
    },
    /**
     * RoR (Rate of Rise) 계산 함수.
     *
     * @param {number[]} timeArray - 시간 데이터 배열 (초 단위 값)
     * @param {number[]} tempArray - 온도 데이터 배열 (평활화된 값)
     * @param {number} deltaSamples - RoR 계산에 사용할 데이터 샘플 개수 (60초: 60, 30초: 30)
     * @param {boolean} polyfitEnabled - true이면 다항식 피팅을 사용하여 계산, false이면 기본 2포인트 방식을 사용.
     * @returns {number} - 계산된 RoR 값 (°C/min). 데이터가 부족하거나 계산 중 오류가 발생하면 0.0을 반환.
     */
    computeRoR: function(timeArray, tempArray, deltaSamples, polyfitEnabled = true) {
        try {
            // 유효한 데이터가 있는지 확인 (최소 2개의 데이터 필요)
            if (timeArray.length > 1) {
                // 사용할 데이터의 범위 설정
                const leftIndex = Math.min(
                    timeArray.length,
                    tempArray.length,
                    Math.max(2, deltaSamples + 1) // 최소 2개 이상의 데이터가 필요
                );

                // 다항식 피팅을 통한 RoR 계산
                if (polyfitEnabled && timeArray.length > deltaSamples) {
                    try {
                        // 다항식 피팅에 사용할 데이터 선택
                        const timeVec = timeArray.slice(-leftIndex); // 최근 데이터 선택
                        const tempSamples = tempArray.slice(-leftIndex); // 최근 온도 데이터 선택

                        // 다항식 피팅 (선형 회귀)
                        const n = timeVec.length; // 데이터 개수
                        const meanTime = timeVec.reduce((sum, t) => sum + t, 0) / n; // 시간의 평균
                        const meanTemp = tempSamples.reduce((sum, t) => sum + t, 0) / n; // 온도의 평균

                        let numerator = 0; // 분자: 시간과 온도 차이의 곱의 합
                        let denominator = 0; // 분모: 시간 차이의 제곱합
                        for (let i = 0; i < n; i++) {
                            numerator += (timeVec[i] - meanTime) * (tempSamples[i] - meanTemp);
                            denominator += Math.pow(timeVec[i] - meanTime, 2);
                        }

                        // 기울기 계산 (slope)
                        const slope = denominator !== 0 ? numerator / denominator : 0;
                        // RoR 계산 (기울기에 60을 곱하여 분당 변화율 계산)
                        return slope * 60; // 분당 변화율 (°C/min)
                    } catch (error) {
                        console.error("Polynomial fitting failed:", error);
                        // 다항식 피팅 실패 시 2포인트 계산으로 대체
                    }
                }

                // 기본 2포인트를 통한 RoR 계산, 가장 최근 값과 deltaSamples 간격의 값을 사용하여 계산
                const timeDifference = timeArray[timeArray.length - 1] - timeArray[timeArray.length - leftIndex];
                if (timeDifference !== 0) {
                    return (
                        ((tempArray[tempArray.length - 1] - tempArray[tempArray.length - leftIndex]) / timeDifference) * 60 // °C/min 단위
                    );
                }
            }
            return 0.0; // 데이터가 부족한 경우
        } catch (error) {
            console.error("ROR 계산 중 오류 발생:", error);
            return 0.0; // 오류 발생 시 0.0 반환
        }
    },
    // ROR 계산 (°C/min)
    calculateROR: function(dsIdx, time, value) {
      let dataList = tempList.bt;
      switch(dsIdx) {
          case tempIdx.ET: 
              dataList = tempList.et;
              break;
      }
      const charge = RoasterManager.getCurrentState() >= RoasterManager.stateEnum.CHARGE;
      const deltaSamples = charge?10:1; // RoR 계산에 사용할 샘플 수 (1분 간격 60, 30초 간견 30)
      const polyfitEnabled = charge; // 다항식 피팅 사용 여부

      dataList.push({ time: time, temp: value, ror: 0});

      const timeArr = dataList.map(entry => entry.time);
      const tempArr = dataList.map(entry => entry.temp);
      const rateOfRiseBT = this.computeRoR(timeArr, tempArr, deltaSamples, polyfitEnabled);
      dataList[dataList.length - 1].ror = rateOfRiseBT;
      return rateOfRiseBT;
    }
  }