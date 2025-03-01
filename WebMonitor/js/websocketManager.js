let isStart = false;
let roastingTime = 0;

let connectionInterval = null;
let connectionTimeout = null;

const applyPreheatButton = document.getElementById('applyPreheat');
const notification = document.getElementById('notification');

function initWebSocket() {
  createWebSocketHtml();
}

function createWebSocketHtml() {
  const button = document.createElement("button");
  button.id = "websocket";
  button.textContent = "Disconnected";
  document.getElementById('header').appendChild(button);

  webSocket.init(document.getElementById('websocket'));
}

// WebSocket 관리
const webSocket = {
  
  websocket: null,
  isConnecting: false, // 연결 시도 상태
  webSocketClickEvent: function() {
    if (webSocket.isConnecting) {
      // 연결 시도 중인 경우 중단
      console.log("Connection attempt aborted.");
      clearInterval(connectionInterval);
      clearInterval(connectionTimeout);
      webSocket.isConnecting = false;
      websocketBtn.textContent = "Disonnected";
      webSocket.close();
    } else if (webSocket.websocket && webSocket.websocket.readyState === WebSocket.OPEN) {
      // 이미 연결된 경우 연결 종료
      console.log("Disconnecting...");
      webSocket.close();
      websocketBtn.textContent = "Disonnected";
    } else {
      // 새로운 연결 시도
      console.log("Attempting to connect...");
      webSocket.init();
    }
  },
  // WebSocket 초기화 함수
  init: function (btn) {
    if(btn != undefined) {
      this.webSocketBtn = btn;
      this.webSocketBtn.addEventListener('click', () => {
        webSocketClickEvent()
      });
    }

    const wsUrl = "ws:/SkyWalker.local/ws"; // 로스터 WebSocket 서버 URL

    this.startConnectingAnimation();
    this.websocket = new WebSocket(wsUrl);
    this.isConnecting = true;

    connectionTimeout = setTimeout(() => {
      console.error("Connection attempt timed out.");
      this.isConnecting = false;
      clearInterval(connectionInterval);
      clearTimeout(connectionTimeout);
      this.close();
      this.websocketBtn.textContent = "Disconnected";
    }, 30000);

    // WebSocket 연결 이벤트
    this.websocket.onopen = () => {
      console.log("WebSocket Connected");
      this.isConnecting = false;
      clearInterval(connectionInterval); // 연결 시도 애니메이션 중지
      clearTimeout(connectionTimeout);
      this.websocketBtn.textContent = "Connected";
    };

    // WebSocket 메시지 수신 이벤트
    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    // WebSocket 메시지 송신 이벤트
    this.websocket.send = (cmd, value) => {
      if(this.websocket.readyState == WebSocket.OPEN) {
        const jsonData = JSON.stringify({cmd:cmd, value:value})
        this.websocket.send(jsonData);
      }
    };

    // WebSocket 오류 이벤트
    this.websocket.onerror = (error) => {
      this.websocketBtn.textContent = "Server Not Found";
      console.error("WebSocket Error:", error);
      setTimeout(() => this.retryConnection(), 500); // 2초 후 연결 재시도
    };

    // WebSocket 종료 이벤트
    this.websocket.onclose = () => {
      console.log("WebSocket Disconnected");
      clearInterval(connectionInterval); // 연결 시도 애니메이션 중지
      if(!this.isConnecting)
        this.websocketBtn.textContent = "Disconnected";
    };
  },
  // 연결 재시도 로직
  retryConnection: function () {
    console.log("Retrying connection...");
    if (this.isConnecting) {
      this.startConnectingAnimation("Retrying");
    }
    setTimeout(() => {
      if (this.isConnecting) {
        clearInterval(connectionInterval);
        this.init()
      }
    }, 1500); // 2초 후 연결 재시도
  },
  // WebSocket 연결 종료
  close: function () {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  },
  // 연결 시도 중 애니메이션
  startConnectingAnimation: function (msg) {
    if(msg === undefined) {
      msg = "Connecting";
    }
    let dots = "";
    clearInterval(connectionInterval); // 이전 애니메이션 정리
    connectionInterval = setInterval(() => {
      dots = dots.length < 3 ? dots + "." : ""; // "..."까지 반복
      websocketBtn.textContent = `${msg}${dots}`;
    }, 500); // 0.5초마다 업데이트
  },
  // 메시지 처리 함수
  handleWebSocketMessage: function (data) {
    console.log("Received data:", data);
    receiveDataRoaster(data);
  },
};

function sendDataRoaster(cmd, value) {
  switch(cmd) {
    case 'charge': {
      const bt = document.querySelector('#bt').textContent.trim();;
      RoastEvent.charge(roastingTime, parseInt(bt));
      break;
    }
    case 'drop': {
      break;
    }
    default: {
      console.log(`send roaster command : ${cmd}, ${value}`);
    }
  }
}

function receiveDataRoaster(data) {
  addData(data.time, data.ET, data.BT, data.heater, data.fan);
}