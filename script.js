
// =====================================
// micro:bit FPV Car PWA（完全互換版）
// LoFi Control互換 / 安定通信版
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
// 送信キュー（安定化）
// ===============================

let queue = [];
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
// 🔥送信（改行付き + キュー制御）
// ===============================

function send(cmd){

    if(!tx || !connected) return;

    queue.push(cmd + "\n"); // ★ここ重要（micro:bit互換）

    processQueue();
}


// ===============================
// 1個ずつ送信
// ===============================

async function processQueue(){

    if(sending) return;
    if(queue.length === 0) return;

    sending = true;

    const cmd = queue.shift();

    try{

        const data =
        new TextEncoder().encode(cmd);

        await tx.writeValueWithoutResponse(data);

        console.log("SEND:", cmd.trim());

    }catch(e){
        console.log("SEND ERROR", e);
    }

    sending = false;

    setTimeout(processQueue, 30);
}


// ===============================
// 十字キー
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
// コマンド（完全一致）
// ===============================

bindPad("UP", "UP", "up");
bindPad("DOWN", "DOWN", "down");
bindPad("LEFT", "LEFT", "left");
bindPad("RIGHT", "RIGHT", "right");


// ===============================
// STOP
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

let speedTimer = null;
let lastCmd = "";

document.getElementById("speedSlider")
.addEventListener("input", e=>{

    const v = parseInt(e.target.value);

    let mapped = 0;

    if(v === 0) mapped = 0;
    else if(v === 1) mapped = 4;
    else if(v === 2) mapped = 8;
    else if(v === 3) mapped = 12;
    else mapped = 15;

    const cmd = "c" + String(mapped).padStart(2,"0");

    if(cmd === lastCmd) return;

    lastCmd = cmd;

    if(speedTimer){
        clearTimeout(speedTimer);
    }

    speedTimer = setTimeout(()=>{
        send(cmd);
    }, 120);

    document.getElementById("speedValue").textContent = v;
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
