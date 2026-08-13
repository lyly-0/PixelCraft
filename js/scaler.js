/**
 * 最邻近插值缩放算法
 * @param {ImageData} sourceData - 原图像素数据
 * @param {number} srcW - 原图宽度
 * @param {number} srcH - 原图高度
 * @param {number} tgtW - 目标宽度
 * @param {number} tgtH - 目标高度
 * @returns {ImageData}
 */
function nearestNeighborScale(sourceData, srcW, srcH, tgtW, tgtH) {
    const targetData = new ImageData(tgtW, tgtH);
    const ratioX = srcW / tgtW;
    const ratioY = srcH / tgtH;

    for (let y = 0; y < tgtH; y++) {
        for (let x = 0; x < tgtW; x++) {
            const srcX = Math.min(Math.floor(x * ratioX), srcW - 1);
            const srcY = Math.min(Math.floor(y * ratioY), srcH - 1);
            const srcIdx = (srcY * srcW + srcX) * 4;
            const tgtIdx = (y * tgtW + x) * 4;

            targetData.data[tgtIdx]     = sourceData.data[srcIdx];
            targetData.data[tgtIdx + 1] = sourceData.data[srcIdx + 1];
            targetData.data[tgtIdx + 2] = sourceData.data[srcIdx + 2];
            targetData.data[tgtIdx + 3] = sourceData.data[srcIdx + 3];
        }
    }

    return targetData;
}

/**
 * 将像素画绘制到画布并放大
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageData} pixelData
 * @param {number} scale
 */
function drawPixelArtScaled(ctx, pixelData, scale) {
    const pw = pixelData.width;
    const ph = pixelData.height;

    ctx.canvas.width = pw * scale;
    ctx.canvas.height = ph * scale;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pw;
    tempCanvas.height = ph;
    tempCanvas.getContext('2d').putImageData(pixelData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, pw, ph, 0, 0, pw * scale, ph * scale);
}
