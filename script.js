
// =====================================
// micro:bit FPV Car PWA（安定版）
// GATTエラー対策済み
// =====================================


// ===============================
// BLE UUID
// ===============================

const UART_SERVICE =
"6e400001-b5a3-f393-e0a9-e50e24dcca9e";

const UART_TX =
"6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let device;
let server;
let service;
let tx;
let connected = false;


// ===============================
// UI
// ===============================

const statusLed = document.getElementById("statusLed");
const statusText = document.getElementById("statusText");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");


// ===============================
// 🔥送信キュー制御（重要）
// ===============================

let sendQueue = [];
let sending = false;


// ===============================
// CONNECT
// ===============================

async function connectBLE(){

    try{

        device = await navigator.bluetooth.requestDevice({

            filters:[{
                namePrefix:"BBC micro:bit"
            }],

            optionalServices:[UART_SERVICE]
        });

        device.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );

        server = await device.gatt.connect();

        service = await server.getPrimaryService(UART_SERVICE);

        tx = await service.getCharacteristic(UART_TX);

        connected = true;

        updateUI(true);

        console.log("CONNECTED");

    }catch(e){
        console.log(e);
        alert("BLE接続失敗");
    }
}


// ===============================
// DISCONNECT
// ===============================

function disconnectBLE(){

    if(device && device.gatt.connected){
        device.gatt.disconnect();
    }
}

function onDisconnected(){

    connected = false;
    updateUI(false);
}

function updateUI(state){

    if(state){

        statusLed.style.background = "lime";
        statusText.textContent = "接続中";
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;

    }else{

        statusLed.style.background = "red";
        statusText.textContent = "未接続";
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
    }
}


// ===============================
// 🔥送信（完全安定版キュー）
// ===============================

function send(cmd){

    if(!tx || !connected) return;

    sendQueue.push(cmd);
    processQueue();
}


// ===============================
// キュー処理（1個ずつ送る）
// ===============================

async function processQueue(){

    if(sending) return;
    if(sendQueue.length === 0) return;

    sending = true;

    const cmd = sendQueue.shift();

    try{

        const data =
        new TextEncoder().encode(cmd);

        await tx.writeValue(data);

        console.log("SEND:", cmd);

    }catch(e){
        console.log("SEND ERROR", e);
    }

    sending = false;

    setTimeout(processQueue, 20);
}


// ===============================
// D-PAD制御
// ===============================

function bindPad(dir, press, release){

    const btn =
    document.querySelector(`[data-dir="${dir}"]`);

    if(!btn) return;

    let timer;


    const start = ()=>{

        if(!connected) return;

        send(press);

        timer = setInterval(()=>{

            send(press);

        }, 200);
    };


    const stop = ()=>{

        clearInterval(timer);

        send(release);
    };


    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", stop);
    btn.addEventListener("mouseleave", stop);

    btn.addEventListener("touchstart", e=>{
        e.preventDefault();
        start();
    }, {passive:false});

    btn.addEventListener("touchend", stop);
}


// ===============================
// micro:bit完全一致コマンド
// ===============================

bindPad("UP", "UP", "up");
bindPad("DOWN", "DOWN", "down");
bindPad("LEFT", "LEFT", "left");
bindPad("RIGHT", "RIGHT", "right");


// ===============================
// STOPボタン
// ===============================

document
.querySelector('[data-dir="STOP"]')
.addEventListener("click", ()=>{

    send("up");
    send("down");
    send("left");
    send("right");
});


// ===============================
// SPEED（c00〜c15）
// ===============================

document
.getElementById("speedSlider")
.addEventListener("input", e=>{

    const v = parseInt(e.target.value);

    let mapped = 0;

    if(v === 0) mapped = 0;
    else if(v === 1) mapped = 4;
    else if(v === 2) mapped = 8;
    else if(v === 3) mapped = 12;
    else mapped = 15;

    send("c" + String(mapped).padStart(2,"0"));

    document.getElementById("speedValue").textContent = v;
});


// ===============================
// TRIM UI（未送信）
// ===============================

document.getElementById("leftTrim")
.addEventListener("input", e=>{
    document.getElementById("leftTrimVal").textContent = e.target.value;
});

document.getElementById("rightTrim")
.addEventListener("input", e=>{
    document.getElementById("rightTrimVal").textContent = e.target.value;
});

document.getElementById("resetTrim")
.addEventListener("click", ()=>{

    document.getElementById("leftTrim").value = 8;
    document.getElementById("rightTrim").value = 0;

    document.getElementById("leftTrimVal").textContent = 8;
    document.getElementById("rightTrimVal").textContent = 0;
});


// ===============================
// BUTTON
// ===============================

connectBtn.onclick = connectBLE;
disconnectBtn.onclick = disconnectBLE;


// ===============================
// INIT
// ===============================

updateUI(false);
