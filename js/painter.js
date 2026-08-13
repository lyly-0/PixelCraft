// ==================== 颜色名称映射表 ====================
const COLOR_NAMES = {
    '#000000': '黑色',
    '#ffffff': '白色',
    '#ff0000': '红色',
    '#00ff00': '绿色',
    '#0000ff': '蓝色',
    '#ffff00': '黄色',
    '#ff00ff': '品红/洋红',
    '#00ffff': '青色',
    '#808080': '灰色',
    '#800000': '栗色/深红',
    '#808000': '橄榄色',
    '#008000': '深绿色',
    '#800080': '紫色',
    '#008080': '蓝绿色',
    '#000080': '海军蓝',
    '#c0c0c0': '银色',
    '#ffa500': '橙色',
    '#a52a2a': '棕色',
    '#ffc0cb': '粉色',
    '#ffd700': '金色',
    '#4b0082': '靛蓝色',
    '#7fffd4': '碧绿色',
    '#f0ffff': '天蓝色',
    '#f5f5dc': '米色',
    '#ffe4c4': '杏色',
    '#8b0000': '暗红色',
    '#006400': '暗绿色',
    '#191970': '午夜蓝',
    '#ff6347': '番茄红',
    '#40e0d0': '绿松色',
    '#ee82ee': '紫罗兰',
    '#dda0dd': '梅红色',
    '#f0e68c': '卡其色',
    '#fa8072': '鲑鱼色',
    '#98fb98': '淡绿色',
    '#87ceeb': '天蓝',
    '#ffb6c1': '浅粉',
    '#ffdead': '纳瓦霍白',
    '#d2b48c': '棕褐色',
    '#b0c4de': '淡钢蓝',
};

/**
 * 将十六进制颜色转换为最接近的已知颜色名
 */
function getColorName(hex) {
    hex = hex.toUpperCase();
    if (COLOR_NAMES[hex]) {
        return COLOR_NAMES[hex];
    }

    // 找最接近的颜色
    const r1 = parseInt(hex.slice(1, 3), 16);
    const g1 = parseInt(hex.slice(3, 5), 16);
    const b1 = parseInt(hex.slice(5, 7), 16);

    let minDist = Infinity;
    let closestName = '自定义颜色';

    for (const [knownHex, name] of Object.entries(COLOR_NAMES)) {
        const r2 = parseInt(knownHex.slice(1, 3), 16);
        const g2 = parseInt(knownHex.slice(3, 5), 16);
        const b2 = parseInt(knownHex.slice(5, 7), 16);
        const dist = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
        if (dist < minDist) {
            minDist = dist;
            closestName = name;
        }
    }

    return closestName;
}

/**
 * 将 RGBA 数组转为十六进制颜色字符串
 */
function rgbaToHex(r, g, b, a) {
    if (a === 0) return '#000000'; // 透明视为黑色
    const toHex = (v) => v.toString(16).padStart(2, '0').toUpperCase();
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

// ==================== 方舟像素调色板（40色） ====================
const ARK_PALETTE = [
    '#222222', '#AAAAAA', '#EAE7E2', '#FFFFFF',
    '#D63333', '#881408', '#D81A4C', '#E8A090',
    '#FF9973', '#F7C8B4', '#F9E8E0', '#F9F2E4',
    '#D9CFC4', '#E2CDAD', '#D86424', '#D48844',
    '#F28E00', '#F4C430', '#F9E29C', '#B4B884',
    '#B8D870', '#606808', '#997848', '#988470',
    '#AA8822', '#442C14', '#784822', '#4C3C54',
    '#2C2244', '#384494', '#584098', '#BCA4E0',
    '#B0B0E0', '#9898B0', '#58A8B0', '#B4D4E0',
    '#84D4E4', '#38A890', '#B4D4C8', '#283864'
];

/**
 * 将任意颜色映射到最近的方舟调色板颜色
 * @param {string} hex - 原始颜色 #RRGGBB
 * @returns {string} 最接近的方舟调色板颜色
 */
function snapToArkPalette(hex) {
    hex = hex.toUpperCase();
    // 如果已经是调色板中的颜色，直接返回
    if (ARK_PALETTE.includes(hex)) {
        return hex;
    }
    const r1 = parseInt(hex.slice(1, 3), 16);
    const g1 = parseInt(hex.slice(3, 5), 16);
    const b1 = parseInt(hex.slice(5, 7), 16);
    let bestColor = ARK_PALETTE[0];
    let bestDist = Infinity;
    for (const paletteColor of ARK_PALETTE) {
        const r2 = parseInt(paletteColor.slice(1, 3), 16);
        const g2 = parseInt(paletteColor.slice(3, 5), 16);
        const b2 = parseInt(paletteColor.slice(5, 7), 16);
        // 使用加权距离（人眼对绿色更敏感）
        const dist = 2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2;
        if (dist < bestDist) {
            bestDist = dist;
            bestColor = paletteColor;
        }
    }
    return bestColor;
}

/**
 * 分析像素画，按颜色分组坐标
 * @param {ImageData} pixelData - 像素画数据
 * @param {number} tolerance - 颜色容差 (0-100)
 * @returns {object} 分析结果
 */
function analyzeColors(pixelData, tolerance = 0, useArkPalette = false) {
    const width = pixelData.width;
    const height = pixelData.height;
    const data = pixelData.data;

    // 使用 Map 按颜色分组
    const colorMap = new Map();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            let hex = rgbaToHex(r, g, b, a);

            // ★ 如果启用了方舟调色板，先将颜色映射到最近的颜色
            if (useArkPalette) {
                hex = snapToArkPalette(hex);
            }

            // 容差合并逻辑（仅在非方舟模式下使用）
            let matchedKey = hex;
            if (!useArkPalette && tolerance > 0) {
                let minDist = Infinity;
                for (const key of colorMap.keys()) {
                    const kr = parseInt(key.slice(1, 3), 16);
                    const kg = parseInt(key.slice(3, 5), 16);
                    const kb = parseInt(key.slice(5, 7), 16);
                    const dist = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2);
                    if (dist <= tolerance * 4.4 && dist < minDist) {
                        minDist = dist;
                        matchedKey = key;
                    }
                }
            }

            if (!colorMap.has(matchedKey)) {
                colorMap.set(matchedKey, []);
            }
            colorMap.get(matchedKey).push([x, y]);
        }
    }

    // 转换为数组
    const colorGroups = [];
    for (const [color, positions] of colorMap) {
        colorGroups.push({
            color: color,
            colorName: getColorName(color),
            count: positions.length,
            positions: positions
        });
    }

    // 按像素数量降序排列
    colorGroups.sort((a, b) => b.count - a.count);

    return {
        width,
        height,
        totalPixels: width * height,
        uniqueColors: colorGroups.length,
        colorGroups,
        arkMode: useArkPalette
    };
}

/**
 * 生成 JSON 指令字符串
 */
function generateJson(colorAnalysis) {
    const json = {
        version: '1.0',
        image: {
            width: colorAnalysis.width,
            height: colorAnalysis.height
        },
        totalPixels: colorAnalysis.totalPixels,
        uniqueColors: colorAnalysis.uniqueColors,
        colorGroups: colorAnalysis.colorGroups
    };
    // 如果使用了方舟模式，添加标记
    if (colorAnalysis.arkMode) {
        json.arkMode = true;
        json.palette = 'arknights';
    }
    return JSON.stringify(json, null, 2);
}
