// ============================================
// micro:bit FPV Car Controller
// LoFi Control互換
// micro:bit UART完全対応版
// ============================================


// ============================================
// BLE UUID
// ============================================

const UART_SERVICE =
"6e400001-b5a3-f393-e0a9-e50e24dcca9e";

const UART_TX =
"6e400002-b5a3-f393-e0a9-e50e24dcca9e";


// ============================================
// BLE変数
// ============================================

let device = null;
let server = null;
let service = null;
let txCharacteristic = null;

let connected = false;


// ============================================
// HTML要素
// ============================================

const statusLed =
document.getElementById("statusLed");

const statusText =
document.getElementById("statusText");

const connectBtn =
document.getElementById("connectBtn");

const disconnectBtn =
document.getElementById("disconnectBtn");

const speedSlider =
document.getElementById("speedSlider");

const speedValue =
document.getElementById("speedValue");

const speedBar =
document.getElementById("speedBar");

const leftTrim =
document.getElementById("leftTrim");

const rightTrim =
document.getElementById("rightTrim");

const leftTrimVal =
document.getElementById("leftTrimVal");

const rightTrimVal =
document.getElementById("rightTrimVal");

const resetTrim =
document.getElementById("resetTrim");


// ============================================
// 接続状態表示
// ============================================

function updateConnectionUI(state){

    connected = state;

    if(state){

        statusLed.classList.add("connected");

        statusText.textContent =
        "接続済み";

        connectBtn.disabled = true;

        disconnectBtn.disabled = false;

    }else{

        statusLed.classList.remove("connected");

        statusText.textContent =
        "未接続";

        connectBtn.disabled = false;

        disconnectBtn.disabled = true;
    }
}


// ============================================
// BLE接続
// ============================================

async function connectBLE(){

    try{

        device =
        await navigator.bluetooth.requestDevice({

            filters:[
                {
                    namePrefix:"BBC micro:bit"
                }
            ],

            optionalServices:[
                UART_SERVICE
            ]
        });


        device.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );


        server =
        await device.gatt.connect();


        service =
        await server.getPrimaryService(
            UART_SERVICE
        );


        txCharacteristic =
        await service.getCharacteristic(
            UART_TX
        );


        updateConnectionUI(true);

        console.log("BLE Connected");

    }catch(e){

        console.log(e);

        alert("Bluetooth接続失敗");
    }
}


// ============================================
// 切断
// ============================================

function disconnectBLE(){

    if(device && device.gatt.connected){

        device.gatt.disconnect();
    }
}


// ============================================
// 切断イベント
// ============================================

function onDisconnected(){

    updateConnectionUI(false);

    console.log("BLE Disconnected");
}


// ============================================
// UART送信
// micro:bit側は
// uart_read_until(NEW_LINE)
// を使用しているため
// 改行必須
// ============================================

async function send(text){

    if(!txCharacteristic)return;

    try{

        const data =
        new TextEncoder().encode(
            text + "\n"
        );

        await txCharacteristic
        .writeValueWithoutResponse(
            data
        );

        console.log("SEND:", text);

    }catch(e){

        console.log(e);
    }
}


// ============================================
// 速度変換
// HTML 0-4
// micro:bit c00-c15
// ============================================

function convertSpeed(level){

    if(level == 0)return 1;
    if(level == 1)return 4;
    if(level == 2)return 8;
    if(level == 3)return 12;
    if(level == 4)return 15;

    return 8;
}


// ============================================
// スピードUI更新
// ============================================

function updateSpeedUI(level){

    speedValue.textContent = level;

    speedBar.style.width =
    ((level / 4) * 100) + "%";
}


// ============================================
// スピード送信
// ============================================

function sendSpeed(level){

    const value =
    convertSpeed(level);

    const cmd =
    "c" +
    String(value).padStart(2,"0");

    send(cmd);
}


// ============================================
// スライダー
// ============================================

speedSlider.addEventListener(
    "input",
    e=>{

        const level =
        parseInt(e.target.value);

        updateSpeedUI(level);

        sendSpeed(level);
    }
);


// ============================================
// トリムUI
// （micro:bitへは送らない）
// ============================================

leftTrim.addEventListener(
    "input",
    e=>{

        leftTrimVal.textContent =
        e.target.value;
    }
);

rightTrim.addEventListener(
    "input",
    e=>{

        rightTrimVal.textContent =
        e.target.value;
    }
);


// ============================================
// トリムリセット
// ============================================

resetTrim.onclick = ()=>{

    leftTrim.value = 8;
    rightTrim.value = 0;

    leftTrimVal.textContent = 8;
    rightTrimVal.textContent = 0;
};


// ============================================
// 十字キー制御
// ============================================

const releaseMap = {

    "UP":"up",
    "DOWN":"down",
    "LEFT":"left",
    "RIGHT":"right"
};


document
.querySelectorAll(".dpad-btn")
.forEach(btn=>{

    const dir =
    btn.dataset.dir;

    let timer = null;


    // =========================
    // 押した時
    // =========================

    const start = ()=>{

        if(!connected)return;


        if(dir === "STOP"){

            send("up");
            send("down");
            send("left");
            send("right");

            return;
        }


        send(dir);


        timer = setInterval(()=>{

            send(dir);

        },120);
    };


    // =========================
    // 離した時
    // =========================

    const stop = ()=>{

        clearInterval(timer);


        if(releaseMap[dir]){

            send(releaseMap[dir]);
        }
    };


    // =========================
    // マウス
    // =========================

    btn.addEventListener(
        "mousedown",
        start
    );

    btn.addEventListener(
        "mouseup",
        stop
    );

    btn.addEventListener(
        "mouseleave",
        stop
    );


    // =========================
    // タッチ
    // =========================

    btn.addEventListener(
        "touchstart",
        e=>{

            e.preventDefault();

            start();
        },
        {passive:false}
    );

    btn.addEventListener(
        "touchend",
        stop
    );
});


// ============================================
// ボタン
// ============================================

connectBtn.onclick =
connectBLE;

disconnectBtn.onclick =
disconnectBLE;


// ============================================
// 初期UI
// ============================================

updateConnectionUI(false);

updateSpeedUI(2);


// ============================================
// PWA Service Worker
// ============================================

if("serviceWorker" in navigator){

    navigator.serviceWorker
    .register("./sw.js")
    .then(()=>{

        console.log(
            "ServiceWorker Registered"
        );

    })
    .catch(err=>{

        console.log(err);
    });
}
