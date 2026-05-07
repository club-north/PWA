
// =====================================
// micro:bit FPV Car PWA（完全安定版）
// BLE + UART 安定統合版
// =====================================


// ===============================
// BLE UUID（micro:bit標準UART）
// ===============================

const UART_SERVICE =
"6e400001-b5a3-f393-e0a9-e50e24dcca9e";

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
// 送信制御（完全安定）
// ===============================

let queue = [];
let sending = false;


// ===============================
// CONNECT（完全安定探索）
// ===============================

async function connectBLE(){

    try{

        device = await navigator.bluetooth.requestDevice({

            acceptAllDevices: true,

            optionalServices:[
                UART_SERVICE
            ]
        });

        device.addEventListener(
            "gattserverdisconnected",
            ()=>{
                connected = false;
                updateUI(false);
            }
        );

        server = await device.gatt.connect();

        service = await server.getPrimaryService(UART_SERVICE);

        const chars = await service.getCharacteristics();

        // ★書き込み可能を自動検出
        tx = chars.find(c =>
            c.properties.write ||
            c.properties.writeWithoutResponse
        );

        if(!tx){
            alert("書き込み可能characteristicが見つかりません");
            return;
        }

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


// ===============================
// UI更新
// ===============================

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
// 🔥送信（完全安定版）
// ===============================

function send(cmd){

    if(!tx || !connected) return;

    queue.push(cmd + "\n");

    processQueue();
}


// ===============================
// 直列送信（GATT完全回避）
// ===============================

async function processQueue(){

    if(sending) return;
    if(queue.length === 0) return;

    sending = true;

    const cmd = queue.shift();

    try{

        const data =
        new TextEncoder().encode(cmd);

        await tx.writeValue(data);

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
// コマンド一致（micro:bit仕様）
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
// SPEED（安定版スライダー）
// ===============================

let lastSpeed = "";
let speedTimer = null;

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

    if(cmd === lastSpeed) return;

    lastSpeed = cmd;

    if(speedTimer) clearTimeout(speedTimer);

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
