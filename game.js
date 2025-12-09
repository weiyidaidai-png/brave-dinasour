// 获取DOM元素
const currentModeElement = document.getElementById('current-mode');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const gameOverScreen = document.getElementById('gameOver');
const currentScoreElement = document.getElementById('current-score');
const highScoreElement = document.getElementById('high-score');
const finalScoreElement = document.getElementById('final-score');
const finalCoinsElement = document.getElementById('final-coins');
const currentSpeedElement = document.getElementById('current-speed');
const currentCoinsElement = document.getElementById('current-coins');

// 游戏状态
let gameState = 'ready'; // ready, playing, gameOver
let score = 0;
let coins = 0;
let highScore = localStorage.getItem('dinoHighScore') || 0;
let frames = 0;

// 加速机制配置
const SPEED_STEP = 0.2; // 每次加速的幅度
const SPEED_INTERVAL = 600; // 加速间隔（帧数，60帧=1秒，所以这里是10秒）
const MAX_SPEED = 400; // 最大速度限制（基础速度4 * 100倍 = 400）

// 昼夜模式配置
const DAY_NIGHT_INTERVAL = 1200; // 昼夜切换间隔（帧数，60帧=1秒，所以这里是20秒）
const TRANSITION_TIME = 30; // 过渡动画时间（帧数，60帧=1秒，所以这里是0.5秒）
let isNightMode = false;
let dayNightFrameCounter = 0;
let isTransitioning = false;
let transitionFrameCounter = 0;
let transitionDirection = 1; // 1 for night, -1 for day
let currentSpeed = 1.0; // 当前游戏速度倍数

// 金币系统配置
const COIN_GENERATION_INTERVAL = 150; // 金币生成间隔（帧数）
const COIN_BASE_SPEED = 3; // 金币基础速度（比障碍物稍慢）
const COIN_SCORE_VALUE = 5; // 每收集一个金币获得的分数
const COIN_RADIUS = 6; // 金币半径
const COIN_Y_POSITIONS = { // 金币可能出现的位置
    ground: canvas.height - 50 - COIN_RADIUS * 2, // 地面附近
    elevated: canvas.height - 50 - COIN_RADIUS * 2 - 40 // 适中高度，需要跳跃收集
};
const MAX_COINS = 10; // 同时存在的最大金币数量
const MAX_COLLECTION_ANIMATION_FRAMES = 30; // 收集动画的最大帧数

// 金币数组
let coinsArray = [];

// 云朵配置
const CLOUD_LAYERS = 3; // 云朵层数（前景、中景、远景）
const CLOUD_CONFIGS = [
    { count: 3, minSize: 30, maxSize: 50, baseSpeed: 1.5, depth: 0.3 }, // 前景云（近）
    { count: 4, minSize: 20, maxSize: 35, baseSpeed: 1.0, depth: 0.5 }, // 中景云（中）
    { count: 5, minSize: 15, maxSize: 25, baseSpeed: 0.6, depth: 0.8 }  // 远景云（远）
];
const CLOUD_Y_RANGE = { min: 20, max: 100 }; // 云朵Y轴范围
let clouds = []; // 云朵数组

// 山脉配置
const MOUNTAIN_LAYERS = 3; // 山脉层数（前景、中景、远景）
const MOUNTAIN_CONFIGS = [
    { count: 2, minWidth: 80, maxWidth: 120, minHeight: 40, maxHeight: 60, baseSpeed: 0.8, depth: 0.4 }, // 前景山脉（近）
    { count: 3, minWidth: 100, maxWidth: 160, minHeight: 60, maxHeight: 90, baseSpeed: 0.4, depth: 0.6 }, // 中景山脉（中）
    { count: 4, minWidth: 120, maxWidth: 200, minHeight: 80, maxHeight: 120, baseSpeed: 0.2, depth: 0.8 }  // 远景山脉（远）
];
const MOUNTAIN_Y_RANGE = { min: 80, max: 120 }; // 山脉Y轴范围（相对于地面）
let mountains = []; // 山脉数组

// 模式切换函数
function toggleDayNightMode() {
    isNightMode = !isNightMode;

    // 更新body类名
    if (isNightMode) {
        document.body.classList.add('night-mode');
        currentModeElement.textContent = 'Night Mode';
    } else {
        document.body.classList.remove('night-mode');
        currentModeElement.textContent = 'Day Mode';
    }
}

// 昼夜模式过渡效果
function updateDayNightTransition() {
    if (isTransitioning) {
        transitionFrameCounter++;

        // 计算过渡进度（0到1）
        const progress = transitionFrameCounter / TRANSITION_TIME;

        // 添加过渡效果（这里可以根据需要添加更多效果）
        // 例如：调整透明度、颜色渐变等

        // 过渡结束
        if (transitionFrameCounter >= TRANSITION_TIME) {
            isTransitioning = false;
            transitionFrameCounter = 0;

            // 切换模式
            toggleDayNightMode();
        }
    }
}

// 昼夜模式自动切换逻辑
function updateDayNightCycle() {
    if (!isTransitioning) {
        dayNightFrameCounter++;

        // 到达切换间隔
        if (dayNightFrameCounter >= DAY_NIGHT_INTERVAL) {
            dayNightFrameCounter = 0;
            isTransitioning = true;
            transitionDirection = isNightMode ? -1 : 1;

            // 触发过渡效果
            updateDayNightTransition();
        }
    }
}

// 设置初始高分
highScoreElement.textContent = highScore;

// 恐龙皮肤配置
const DINO_SKINS = {
    default: { name: '默认', bodyColor: '#000', eyeColor: '#fff', pupilColor: '#000', hasDecoration: false },
    green: { name: '绿色', bodyColor: '#2ecc71', eyeColor: '#fff', pupilColor: '#000', hasDecoration: false },
    blue: { name: '蓝色', bodyColor: '#3498db', eyeColor: '#fff', pupilColor: '#000', hasDecoration: false },
    red: { name: '红色', bodyColor: '#e74c3c', eyeColor: '#fff', pupilColor: '#000', hasDecoration: false },
    yellow: { name: '黄色', bodyColor: '#f1c40f', eyeColor: '#333', pupilColor: '#000', hasDecoration: true, decorationColor: '#f39c12' },
    purple: { name: '紫色', bodyColor: '#9b59b6', eyeColor: '#fff', pupilColor: '#000', hasDecoration: true, decorationColor: '#8e44ad' }
};

// 当前选中的皮肤
let currentSkin = 'default';

// 恐龙对象
const dino = {
    x: 50,
    y: canvas.height - 50 - 20, // 距离地面20px
    width: 20,
    height: 20,
    dy: 0,
    gravity: 0.5,
    jumpPower: -10,
    grounded: true
};

// 障碍物数组
const obstacles = [];

// 障碍物类
class Obstacle {
    constructor() {
        this.width = 15;
        this.height = 25 + Math.random() * 25; // 随机高度
        this.x = canvas.width;
        this.y = canvas.height - 50 - this.height; // 距离地面
        this.baseSpeed = 4; // 基础速度
    }

    update() {
        // 根据当前游戏速度调整障碍物移动速度
        this.x -= this.baseSpeed * currentSpeed;
    }

    draw() {
        // 根据当前模式设置障碍物颜色
        ctx.fillStyle = isNightMode ? '#f0f0f0' : '#000';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // 添加像素风格细节
        ctx.fillStyle = isNightMode ? '#ccc' : '#333';
        ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    }
}

// 金币类
class Coin {
    constructor() {
        this.radius = COIN_RADIUS;
        this.x = canvas.width + this.radius; // 从屏幕右侧出现
        this.y = this.getRandomYPosition(); // 随机选择出现位置
        this.baseSpeed = COIN_BASE_SPEED; // 基础速度
        this.collected = false; // 是否已被收集
        this.alpha = 1; // 透明度，用于收集时的淡出效果
        this.scale = 1; // 缩放，用于收集时的视觉反馈
        this.collectionAnimationFrames = 0; // 收集动画帧计数器
    }

    // 获取随机的Y轴位置
    getRandomYPosition() {
        // 随机选择地面附近或适中高度位置
        return Math.random() < 0.5 ? COIN_Y_POSITIONS.ground : COIN_Y_POSITIONS.elevated;
    }

    // 更新金币状态
    update() {
        // 如果已被收集，则执行收集动画并返回
        if (this.collected) {
            this.handleCollectionAnimation();
            return;
        }

        // 根据当前游戏速度调整金币移动速度
        this.x -= this.baseSpeed * currentSpeed;
    }

    // 处理收集动画效果
    handleCollectionAnimation() {
        // 增加动画帧计数器
        this.collectionAnimationFrames++;

        // 增大缩放比例
        this.scale += 0.1;

        // 降低透明度
        this.alpha -= 0.05;

        // 确保 alpha 值不会低于 0
        this.alpha = Math.max(0, this.alpha);
    }

    // 绘制金币
    draw() {
        // 如果已被收集，且透明度为0，则不绘制
        if (this.collected && this.alpha <= 0) {
            return;
        }

        // 保存当前绘图状态
        ctx.save();

        // 设置透明度
        ctx.globalAlpha = this.alpha;

        // 设置缩放变换
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-this.x, -this.y);

        // 绘制金币主体 - 使用简单的颜色，移除复杂的渐变和发光效果
        if (isNightMode) {
            // 夜间模式下金币颜色
            ctx.fillStyle = '#D4AF37';
        } else {
            // 白天模式下金币颜色
            ctx.fillStyle = '#FFD700';
        }

        ctx.beginPath();
        ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // 绘制金币边缘 - 增加简单的立体感
        if (isNightMode) {
            ctx.strokeStyle = '#8B6914';
        } else {
            ctx.strokeStyle = '#DAA520';
        }

        ctx.lineWidth = 1;
        ctx.stroke();

        // 恢复绘图状态
        ctx.restore();
    }
}

// 云朵类
class Cloud {
    constructor(layerIndex) {
        this.layerIndex = layerIndex;
        this.config = CLOUD_CONFIGS[layerIndex];

        // 随机大小
        this.size = this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize);

        // 随机初始X位置（确保云朵分布在整个宽度范围内）
        this.x = Math.random() * canvas.width;

        // 随机Y位置，在指定范围内
        this.y = CLOUD_Y_RANGE.min + Math.random() * (CLOUD_Y_RANGE.max - CLOUD_Y_RANGE.min);

        // 随机偏移量，用于生成不规则形状
        this.offset1 = Math.random() * 5;
        this.offset2 = Math.random() * 5;
        this.offset3 = Math.random() * 5;
    }

    update() {
        // 根据云朵层级和当前游戏速度调整移动速度
        this.x -= this.config.baseSpeed * currentSpeed * this.config.depth;

        // 当云朵移出屏幕左侧时，从右侧重新进入
        if (this.x + this.size < 0) {
            this.x = canvas.width + Math.random() * 100; // 增加随机偏移，避免云朵重叠
            this.y = CLOUD_Y_RANGE.min + Math.random() * (CLOUD_Y_RANGE.max - CLOUD_Y_RANGE.min); // 随机Y位置
        }
    }

    draw() {
        // 根据昼夜模式设置云朵颜色和透明度
        if (isNightMode) {
            // 夜间模式下云朵更暗且透明度更低
            ctx.fillStyle = `rgba(128, 128, 128, ${0.3 + this.config.depth * 0.2})`;
        } else {
            // 白天模式下云朵更亮且透明度更高
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + this.config.depth * 0.3})`;
        }

        // 绘制不规则形状的云朵（使用多个椭圆组合）
        ctx.beginPath();
        ctx.arc(this.x + this.size * 0.2, this.y + this.size * 0.3, this.size * 0.2 + this.offset1, 0, Math.PI * 2);
        ctx.arc(this.x + this.size * 0.5, this.y + this.size * 0.2, this.size * 0.25 + this.offset2, 0, Math.PI * 2);
        ctx.arc(this.x + this.size * 0.8, this.y + this.size * 0.3, this.size * 0.2 + this.offset3, 0, Math.PI * 2);
        ctx.arc(this.x + this.size * 0.4, this.y + this.size * 0.5, this.size * 0.15, 0, Math.PI * 2);
        ctx.arc(this.x + this.size * 0.6, this.y + this.size * 0.5, this.size * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // 添加云朵边框，增强像素风格效果
        ctx.strokeStyle = isNightMode ? `rgba(100, 100, 100, ${0.5})` : `rgba(200, 200, 200, ${0.6})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// 山脉类
class Mountain {
    constructor(layerIndex) {
        this.layerIndex = layerIndex;
        this.config = MOUNTAIN_CONFIGS[layerIndex];

        // 随机大小
        this.width = this.config.minWidth + Math.random() * (this.config.maxWidth - this.config.minWidth);
        this.height = this.config.minHeight + Math.random() * (this.config.maxHeight - this.config.minHeight);

        // 随机初始X位置（确保山脉分布在整个宽度范围内）
        this.x = Math.random() * canvas.width;

        // 计算Y位置（山脉底部与地面接触）
        this.y = ground.y - this.height + (Math.random() * (MOUNTAIN_Y_RANGE.max - MOUNTAIN_Y_RANGE.min) - MOUNTAIN_Y_RANGE.min);

        // 生成山脉的轮廓点（用于绘制不规则的山脉形状）
        this.generateMountainShape();
    }

    generateMountainShape() {
        this.points = [];
        const segments = Math.floor(this.width / 10) + 1; // 每10像素一个段

        // 左端点
        this.points.push({ x: 0, y: this.height });

        // 生成中间的峰值点
        for (let i = 1; i < segments; i++) {
            const x = (i / segments) * this.width;
            // 生成随机的Y值，创造山脉起伏的效果
            const randomY = Math.random() * (this.height * 0.6) + (this.height * 0.2);
            this.points.push({ x, y: randomY });
        }

        // 右端点
        this.points.push({ x: this.width, y: this.height });
    }

    update() {
        // 根据山脉层级和当前游戏速度调整移动速度
        this.x -= this.config.baseSpeed * currentSpeed * this.config.depth;

        // 当山脉移出屏幕左侧时，从右侧重新进入
        if (this.x + this.width < 0) {
            this.x = canvas.width + Math.random() * 200; // 增加随机偏移，避免山脉重叠

            // 重新生成大小和形状
            this.width = this.config.minWidth + Math.random() * (this.config.maxWidth - this.config.minWidth);
            this.height = this.config.minHeight + Math.random() * (this.config.maxHeight - this.config.minHeight);

            // 重新计算Y位置
            this.y = ground.y - this.height + (Math.random() * (MOUNTAIN_Y_RANGE.max - MOUNTAIN_Y_RANGE.min) - MOUNTAIN_Y_RANGE.min);

            // 重新生成山脉形状
            this.generateMountainShape();
        }
    }

    draw() {
        // 根据昼夜模式和山脉层级设置山脉颜色
        let color;
        if (isNightMode) {
            // 夜间模式下山脉更暗，且远景山脉更蓝
            const darkness = 0.3 + (1 - this.config.depth) * 0.3; // 前景山脉更亮一些
            color = `rgba(30, 40, 60, ${darkness})`;
        } else {
            // 白天模式下山脉为灰色调，远景山脉颜色更浅
            const grayValue = 100 + (1 - this.config.depth) * 50; // 前景山脉颜色更深
            color = `rgba(${grayValue}, ${grayValue}, ${grayValue}, 0.8)`;
        }

        // 绘制山脉形状
        ctx.fillStyle = color;
        ctx.beginPath();

        // 移动到第一个点
        ctx.moveTo(this.x + this.points[0].x, this.y + this.points[0].y);

        // 连接所有点形成山脉轮廓
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.x + this.points[i].x, this.y + this.points[i].y);
        }

        // 连接到山脉底部的右侧
        ctx.lineTo(this.x + this.width, this.y + this.height);

        // 连接到山脉底部的左侧，形成闭合路径
        ctx.lineTo(this.x, this.y + this.height);

        // 填充山脉形状
        ctx.fill();

        // 添加山脉轮廓线，增强像素风格效果
        const strokeAlpha = isNightMode ? 0.3 : 0.5;
        ctx.strokeStyle = `rgba(0, 0, 0, ${strokeAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// 地面对象
const ground = {
    x: 0,
    y: canvas.height - 50,
    width: canvas.width,
    height: 50
};

// 绘制地面
function drawGround() {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(ground.x, ground.y, ground.width, ground.height);

    // 添加地面纹理
    ctx.fillStyle = '#654321';
    for (let i = 0; i < ground.width; i += 20) {
        ctx.fillRect(i, ground.y + 10, 10, 10);
    }
}

// 初始化云朵
function initClouds() {
    clouds = []; // 清空云朵数组

    // 为每一层创建指定数量的云朵
    for (let layer = 0; layer < CLOUD_LAYERS; layer++) {
        const config = CLOUD_CONFIGS[layer];
        for (let i = 0; i < config.count; i++) {
            clouds.push(new Cloud(layer));
        }
    }
}

// 初始化山脉
function initMountains() {
    mountains = []; // 清空山脉数组

    // 为每一层创建指定数量的山脉
    for (let layer = 0; layer < MOUNTAIN_LAYERS; layer++) {
        const config = MOUNTAIN_CONFIGS[layer];
        for (let i = 0; i < config.count; i++) {
            mountains.push(new Mountain(layer));
        }
    }
}

// 更新云朵
function updateClouds() {
    for (let cloud of clouds) {
        cloud.update();
    }
}

// 绘制云朵
function drawClouds() {
    // 按层级从后到前绘制（远景云先绘制，前景云最后绘制）
    // 这样可以确保前景云显示在远景云的前面，增强层次感
    for (let layer = CLOUD_LAYERS - 1; layer >= 0; layer--) {
        const layerClouds = clouds.filter(cloud => cloud.layerIndex === layer);
        for (let cloud of layerClouds) {
            cloud.draw();
        }
    }
}

// 更新山脉
function updateMountains() {
    for (let mountain of mountains) {
        mountain.update();
    }
}

// 绘制山脉
function drawMountains() {
    // 按层级从后到前绘制（远景山脉先绘制，前景山脉最后绘制）
    // 这样可以确保前景山脉显示在远景山脉的前面，增强层次感
    for (let layer = MOUNTAIN_LAYERS - 1; layer >= 0; layer--) {
        const layerMountains = mountains.filter(mountain => mountain.layerIndex === layer);
        for (let mountain of layerMountains) {
            mountain.draw();
        }
    }
}

// 调整颜色亮度（用于昼夜模式）
function adjustColorBrightness(color, brightnessFactor) {
    // 解析RGB颜色
    const r = parseInt(color.substring(1, 3), 16);
    const g = parseInt(color.substring(3, 5), 16);
    const b = parseInt(color.substring(5, 7), 16);

    // 调整亮度
    const adjustedR = Math.min(255, Math.max(0, r * brightnessFactor));
    const adjustedG = Math.min(255, Math.max(0, g * brightnessFactor));
    const adjustedB = Math.min(255, Math.max(0, b * brightnessFactor));

    // 转换回十六进制颜色
    return `#${Math.floor(adjustedR).toString(16).padStart(2, '0')}${Math.floor(adjustedG).toString(16).padStart(2, '0')}${Math.floor(adjustedB).toString(16).padStart(2, '0')}`;
}

// 绘制恐龙
function drawDino() {
    const skin = DINO_SKINS[currentSkin];
    const brightnessFactor = isNightMode ? 0.8 : 1.0; // 夜间模式降低亮度

    // 调整皮肤颜色亮度
    const adjustedBodyColor = adjustColorBrightness(skin.bodyColor, brightnessFactor);
    const adjustedEyeColor = adjustColorBrightness(skin.eyeColor, brightnessFactor);
    const adjustedPupilColor = adjustColorBrightness(skin.pupilColor, brightnessFactor);
    const adjustedDecorationColor = skin.hasDecoration ? adjustColorBrightness(skin.decorationColor, brightnessFactor) : null;

    // 绘制恐龙身体
    ctx.fillStyle = adjustedBodyColor;
    ctx.fillRect(dino.x, dino.y, dino.width, dino.height);

    // 绘制装饰（如果有）
    if (skin.hasDecoration) {
        ctx.fillStyle = adjustedDecorationColor;
        // 为黄色皮肤绘制皇冠，为紫色皮肤绘制角
        if (currentSkin === 'yellow') {
            // 绘制皇冠
            ctx.fillRect(dino.x + 2, dino.y - 3, 3, 3);
            ctx.fillRect(dino.x + 7, dino.y - 4, 3, 4);
            ctx.fillRect(dino.x + 12, dino.y - 3, 3, 3);
        } else if (currentSkin === 'purple') {
            // 绘制角
            ctx.fillRect(dino.x + 4, dino.y - 5, 2, 5);
            ctx.fillRect(dino.x + 12, dino.y - 5, 2, 5);
        }
    }

    // 添加像素风格的眼睛
    ctx.fillStyle = adjustedEyeColor;
    ctx.fillRect(dino.x + 12, dino.y + 5, 4, 4);
    ctx.fillStyle = adjustedPupilColor;
    ctx.fillRect(dino.x + 14, dino.y + 7, 2, 2);
}

// 更新恐龙
function updateDino() {
    // 应用重力
    dino.dy += dino.gravity;
    dino.y += dino.dy;

    // 检查是否落地
    if (dino.y >= canvas.height - 50 - dino.height) {
        dino.y = canvas.height - 50 - dino.height;
        dino.dy = 0;
        dino.grounded = true;
    } else {
        dino.grounded = false;
    }
}

// 跳跃
function jump() {
    if (dino.grounded) {
        dino.dy = dino.jumpPower;
        dino.grounded = false;
    }
}

// 更新障碍物
function updateObstacles() {
    // 生成障碍物
    if (frames % 60 === 0) {
        obstacles.push(new Obstacle());
    }

    // 更新和绘制障碍物
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        obstacles[i].draw();

        // 检查是否超出屏幕
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            score += 10; // 通过障碍物加分
            currentScoreElement.textContent = score;
        }
    }
}

// 更新金币
function updateCoins() {
    // 生成金币（随机间隔，增加游戏趣味性）
    const generationChance = 1 / COIN_GENERATION_INTERVAL; // 生成概率
    if (Math.random() < generationChance && coinsArray.length < MAX_COINS) {
        coinsArray.push(new Coin());
    }

    // 更新和绘制金币
    for (let i = coinsArray.length - 1; i >= 0; i--) {
        const coin = coinsArray[i];

        coin.update();
        coin.draw();

        // 检查是否需要移除金币
        if (
            // 超出屏幕且未被收集
            (coin.x + coin.radius * 2 < 0 && !coin.collected) ||
            // 已被收集且透明度足够低
            (coin.collected && coin.alpha <= 0.001) ||
            // 已被收集且动画帧数达到最大值
            (coin.collected && coin.collectionAnimationFrames >= MAX_COLLECTION_ANIMATION_FRAMES)
        ) {
            coinsArray.splice(i, 1);
        }
    }

    // 定期清理金币数组，移除可能由于异常情况而没有被自动移除的金币
    if (frames % 300 === 0) { // 每300帧清理一次（约5秒）
        coinsArray = coinsArray.filter(coin => {
            // 保留未收集且在屏幕内的金币
            if (!coin.collected && coin.x + coin.radius * 2 >= 0) {
                return true;
            }

            // 保留已收集但动画尚未完成的金币
            if (coin.collected && coin.collectionAnimationFrames < MAX_COLLECTION_ANIMATION_FRAMES) {
                return true;
            }

            // 移除其他所有金币
            return false;
        });
    }
}

// 检查金币碰撞
function checkCoinCollision() {
    for (let i = coinsArray.length - 1; i >= 0; i--) {
        const coin = coinsArray[i];

        // 如果金币已被收集，则跳过
        if (coin.collected) {
            continue;
        }

        // 检查恐龙与金币是否碰撞
        if (
            dino.x < coin.x + coin.radius * 2 &&
            dino.x + dino.width > coin.x &&
            dino.y < coin.y + coin.radius * 2 &&
            dino.y + dino.height > coin.y
        ) {
            // 标记金币为已收集
            coin.collected = true;

            // 更新金币数量和分数
            coins++;
            score += COIN_SCORE_VALUE;

            // 更新UI显示
            currentCoinsElement.textContent = coins;
            currentScoreElement.textContent = score;

            // 这里可以添加收集提示音（可选）
            // playCoinCollectionSound();
        }
    }
}

// 碰撞检测
function checkCollision() {
    for (let obstacle of obstacles) {
        if (
            dino.x < obstacle.x + obstacle.width &&
            dino.x + dino.width > obstacle.x &&
            dino.y < obstacle.y + obstacle.height &&
            dino.y + dino.height > obstacle.y
        ) {
            return true;
        }
    }
    return false;
}

// 游戏结束
function endGame() {
    gameState = 'gameOver';

    // 更新最高分
    const oldHighScore = highScore;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('dinoHighScore', highScore);
        highScoreElement.textContent = highScore;
    }

    // 显示游戏结束界面
    finalScoreElement.textContent = score;
    finalCoinsElement.textContent = coins; // 显示最终金币数量

    // 如果创造了新纪录，显示特殊提示
    const gameOverMessage = document.querySelector('#gameOver h2');
    if (score > oldHighScore) {
        gameOverMessage.textContent = '🎉 新纪录！';
        gameOverMessage.style.color = '#f39c12'; // 金色
    } else {
        gameOverMessage.textContent = '游戏结束';
        gameOverMessage.style.color = '#e74c3c'; // 红色
    }

    gameOverScreen.classList.remove('hidden');
}

// 重置游戏
function resetGame() {
    gameState = 'ready';
    score = 0;
    coins = 0; // 重置金币数量
    frames = 0;
    currentSpeed = 1.0; // 重置游戏速度
    obstacles.length = 0; // 清空障碍物数组
    coinsArray.length = 0; // 清空金币数组

    // 重置恐龙位置
    dino.x = 50;
    dino.y = canvas.height - 50 - 20;
    dino.dy = 0;
    dino.grounded = true;

    // 重置云朵
    initClouds();

    // 重置山脉
    initMountains();

    // 重置界面
    currentScoreElement.textContent = score;
    currentCoinsElement.textContent = coins; // 重置金币显示
    currentSpeedElement.textContent = currentSpeed.toFixed(1); // 重置速度显示
    gameOverScreen.classList.add('hidden');
}

// 游戏主循环
function gameLoop() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制地面
    drawGround();

    // 绘制山脉（山脉应在地面之上，云朵之下）
    drawMountains();

    // 绘制云朵（云朵应在山脉之上，恐龙和障碍物之下）
    drawClouds();

    if (gameState === 'playing') {
        frames++;

        // 更新云朵
        updateClouds();

        // 更新山脉
        updateMountains();

        // 更新和绘制恐龙
        updateDino();
        drawDino();

        // 更新和绘制障碍物
        updateObstacles();

        // 更新和绘制金币
        updateCoins();

        // 检查障碍物碰撞
        if (checkCollision()) {
            endGame();
        }

        // 检查金币碰撞
        checkCoinCollision();

        // 定期增加游戏速度
        if (frames % SPEED_INTERVAL === 0 && currentSpeed < MAX_SPEED / 4) {
            currentSpeed += SPEED_STEP;
            // 更新速度显示
            currentSpeedElement.textContent = currentSpeed.toFixed(1);
        }

        // 更新昼夜模式循环
        updateDayNightCycle();

        // 更新昼夜模式过渡效果
        updateDayNightTransition();
    } else if (gameState === 'ready') {
        // 绘制准备状态的恐龙
        drawDino();

        // 显示游戏说明（已在HTML中提供中文说明）
        // 这里不再重复显示，保持画布简洁
    }

    // 请求下一帧
    requestAnimationFrame(gameLoop);
}

// 事件监听器
startButton.addEventListener('click', () => {
    if (gameState === 'ready') {
        gameState = 'playing';
        startButton.style.display = 'none';
    }
});

restartButton.addEventListener('click', () => {
    resetGame();
    startButton.style.display = 'inline-block';
});

// 键盘事件
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault(); // 防止空格键滚动页面

        if (gameState === 'ready') {
            gameState = 'playing';
            startButton.style.display = 'none';
        } else if (gameState === 'playing') {
            jump();
        }
    }
});

// 点击屏幕事件 - 支持同时点击和空格键
canvas.addEventListener('click', () => {
    if (gameState === 'ready') {
        gameState = 'playing';
        startButton.style.display = 'none';
    } else if (gameState === 'playing') {
        jump();
    }
});

// 触摸事件 - 支持移动设备触摸跳跃
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 防止触摸时的默认行为（如缩放）

    if (gameState === 'ready') {
        gameState = 'playing';
        startButton.style.display = 'none';
    } else if (gameState === 'playing') {
        jump();
    }
});

// 皮肤选择事件监听器
function initSkinSelector() {
    const skinOptions = document.querySelectorAll('.skin-option');

    skinOptions.forEach(option => {
        option.addEventListener('click', () => {
            // 获取选择的皮肤
            const selectedSkin = option.dataset.skin;

            // 更新当前皮肤
            currentSkin = selectedSkin;

            // 更新UI - 移除所有选中状态，为当前选中项添加选中状态
            skinOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            // 如果游戏处于准备状态，立即重绘恐龙以显示新皮肤
            if (gameState === 'ready') {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawGround();
                drawMountains();
                drawClouds();
                drawDino();
            }
        });
    });
}

// 初始化云朵
initClouds();

// 初始化山脉
initMountains();

// 初始化皮肤选择器
initSkinSelector();

// 启动游戏循环
gameLoop();
