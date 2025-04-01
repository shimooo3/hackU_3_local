/**
 * 感情に基づいて座標を計算する関数
 * @param {string} emotion 感情（"喜"、"怒"、"哀"、"楽"）
 * @param {number} mean 平均値
 * @param {number} variance 分散値
 * @return {Object} 計算された x, y 座標
 */
function calculateCoordinatesForEmotion(emotion, mean, variance) {
    // 座標オフセット値
    let xOffset = 0, yOffset = 0;

    // 感情に応じたオフセットを設定
    switch (emotion) {
        case "喜":
            // 喜び: 平均大、分散大に移動
            xOffset = 0.2;
            yOffset = 0.2;
            break;
        case "怒":
            // 怒り: 平均小、分散大に移動
            xOffset = -0.2;
            yOffset = 0.2;
            break;
        case "哀":
            // 哀しみ: 平均小、分散小に移動
            xOffset = -0.2;
            yOffset = -0.2;
            break;
        case "楽":
            // 楽しさ: 平均大、分散小に移動
            xOffset = 0.2;
            yOffset = -0.2;
            break;
        default:
            // 不明な感情は原点に近い位置
            console.log("不明な感情:", emotion);
            break;
    }

    // 基準値（平均と分散）を元にオフセットを適用
    let x = mean + xOffset;
    let y = variance + yOffset;

    // 0-1の範囲に収める（境界値の場合は少しだけ内側にずらす）
    x = Math.max(0.001, Math.min(0.999, x));
    y = Math.max(0.001, Math.min(0.999, y));

    return { x, y };
}

/**
 * 値を0-1の範囲に正規化する関数
 * @param {number} value 正規化する値
 * @param {number} min 最小値
 * @param {number} max 最大値
 * @return {number} 正規化された値
 */
function normalizeValue(value, min, max) {
    if (min === max) return 0.5;
    return (value - min) / (max - min);
}

/**
 * 特徴ベクトルの平均と分散を計算し、normalizeValueで正規化した値を返す
 * @param {Array} vector 特徴ベクトル
 * @return {Object} 平均と分散（生値と正規化値）を含むオブジェクト
 */
function calculateStats(vector) {
    if (!vector || vector.length === 0) {
        return {
            mean: 0,
            variance: 0,
            normalizedMean: 0.5,
            normalizedVariance: 0.5
        };
    }

    const sum = vector.reduce((acc, val) => acc + val, 0);
    const mean = sum / vector.length;
    const squaredDiffs = vector.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / vector.length;

    // 正規化のための範囲
    const MIN_MEAN = 0;
    const MAX_MEAN = 1;
    const MIN_VARIANCE = 0;
    const MAX_VARIANCE = 0.1;

    const normalizedMean = normalizeValue(mean, MIN_MEAN, MAX_MEAN);
    const normalizedVariance = normalizeValue(variance, MIN_VARIANCE, MAX_VARIANCE);

    return {
        mean,
        variance,
        normalizedMean,
        normalizedVariance
    };
}

/**
 * 画像と感情から埋め込みベクトルを生成
 * @param {HTMLImageElement} image target image
 * @param {string} emotion 感情（"喜"、"怒"、"哀"、"楽"）
 * @return {Object} 埋め込みベクトルとメタデータを含むオブジェクト
 */
function image2vec(image, emotion = "楽") {
    console.log('called image2vec func with emotion:', emotion);

    // 固定の次元数
    const dimensions = 16;

    if (!image || !image.naturalWidth) {
        console.error('invalid image: ', image);
        return {
            vector: Array(dimensions).fill(0),
            metadata: { error: 'Invalid image' },
            stats: {
                mean: 0,
                variance: 0,
                normalizedMean: 0.5,
                normalizedVariance: 0.5
            }
        };
    }

    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // resize
        const size = 64; // size = n x 16
        canvas.width = size;
        canvas.height = size;

        context.drawImage(image, 0, 0, size, size);
        const imageData = context.getImageData(0, 0, size, size);
        const data = imageData.data;

        console.log('get embedding vector', data.length, 'bytes');

        const vector = [];
        const regionsPerSide = Math.sqrt(dimensions);
        const regionSize = size / regionsPerSide;

        const metadata = {
            imageSize: { width: image.naturalWidth, height: image.naturalHeight },
            processedSize: size,
            regionsPerSide: regionsPerSide,
            timestamp: new Date().toISOString()
        };

        for (let regY = 0; regY < regionsPerSide; regY++) {
            for (let regX = 0; regX < regionsPerSide; regX++) {
                let r = 0, g = 0, b = 0, count = 0;

                for (let y = Math.floor(regY * regionSize); y < Math.floor((regY + 1) * regionSize); y++) {
                    for (let x = Math.floor(regX * regionSize); x < Math.floor((regX + 1) * regionSize); x++) {
                        const idx = (y * size + x) * 4;
                        r += data[idx];
                        g += data[idx + 1];
                        b += data[idx + 2];
                        count++;
                    }
                }

                if (count > 0) {
                    const featureValue = (r + g + b) / (3 * count) / 255
                    vector.push(featureValue);
                }
            }
        }

        // 0 padding
        while (vector.length < dimensions) {
            vector.push(0);
        }
        const finalVector = vector.slice(0, dimensions);

        // var, mean
        const stats = calculateStats(finalVector);
        const coordinates = calculateCoordinatesForEmotion(emotion, stats.normalizedMean, stats.normalizedVariance);

        const adjustedStats = {
            mean: stats.mean,
            variance: stats.variance,
            normalizedMean: stats.normalizedMean,
            normalizedVariance: stats.normalizedVariance,
            // 座標値を追加
            x: coordinates.x,
            y: coordinates.y
        };

        console.log('感情:', emotion);
        console.log('元の値: mean=', stats.mean, 'var=', stats.variance);
        console.log('正規化値: norm mean=', stats.normalizedMean, 'norm var=', stats.normalizedVariance);
        console.log('オフセット適用後の座標: x=', coordinates.x, 'y=', coordinates.y);

        return {
            vector: finalVector,
            metadata: {
                ...metadata,
                emotion: emotion
            },
            stats: adjustedStats
        };
    } catch (error) {
        console.error('error in embedding vector:', error);
        return {
            vector: Array(dimensions).fill(0),
            metadata: { error: error.message, emotion: emotion },
            stats: {
                mean: 0,
                variance: 0,
                normalizedMean: 0.5,
                normalizedVariance: 0.5,
                x: 0.5,
                y: 0.5
            }
        };
    }
}

/**
 * DNNモデルを使用して画像を特徴ベクトルに変換する関数
 * need model.js
 * @param {HTMLImageElement} image 画像要素
 * @param {number} dimensions 出力次元数 (デフォルト: 16)
 * @return {Object} 特徴ベクトルとメタデータを含むオブジェクト
 */
async function image2vecDNN(image, dimensions = 16) {
    console.log('called image2vecDNN func');

    if (!image || !image.naturalWidth) {
        console.error('invalid image: ', image);
        return {
            vector: Array(dimensions).fill(0),
            metadata: { error: 'Invalid image' },
            stats: {
                mean: 0,
                variance: 0,
                normalizedMean: 0.5,
                normalizedVariance: 0.5
            }
        };
    }

    try {
        const featuresData = await extractFeatures(image);
        const vectorLength = featuresData.length;
        const step = Math.floor(vectorLength / dimensions);

        const finalVector = [];
        for (let i = 0; i < dimensions; i++) {
            const index = Math.min(i * step, vectorLength - 1);
            finalVector.push(featuresData[index]);
        }

        // mean, var
        const stats = calculateStats(finalVector);
        console.log('DNN: mean=', stats.mean, 'var=', stats.variance);
        console.log('DNN: norm mean=', stats.normalizedMean, 'norm var=', stats.normalizedVariance);

        return {
            vector: finalVector,
            metadata: {
                imageSize: { width: image.naturalWidth, height: image.naturalHeight },
                originalLength: vectorLength,
                modelType: 'MobileNet',
                timestamp: new Date().toISOString()
            },
            stats: stats
        };
    } catch (error) {
        console.error('DNN error:', error);
        return {
            vector: Array(dimensions).fill(0),
            metadata: { error: error.message },
            stats: {
                mean: 0,
                variance: 0,
                normalizedMean: 0.5,
                normalizedVariance: 0.5
            }
        };
    }
}

/**
 * Firestoreコレクションから画像データを取得して、特徴量との最近傍をN件探す
 * @param {number} mean 入力画像の平均値
 * @param {number} variance 入力画像の分散値
 * @param {number} n 取得する最近傍の数 (デフォルト: 5)
 * @return {Promise<Object>} 最も近いN件のデータ（距離順）と整形されたJSONデータ
 */
async function findNearestImageInFirestore(mean, variance, n = 2) {
    if (typeof mean !== 'number' || typeof variance !== 'number') {
        console.error('invalid parameters: mean=', mean, 'variance=', variance);
        return {
            nearest: null,
            sortedResults: []
        };
    }

    try {
        console.log(`search firestore: mean=${mean}, variance=${variance}, n=${n}`);

        // collection name = 'book_score'
        const collectionRef = db.collection('book_score');
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
            console.log('no data');
            return {
                nearest: null,
                sortedResults: []
            };
        }

        const docsWithDistance = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const docMean = parseFloat(data.mean);
            const docVar = parseFloat(data.var);
            const distance = Math.sqrt(
                Math.pow(mean - docMean, 2) +
                Math.pow(variance - docVar, 2)
            );

            docsWithDistance.push({
                id: doc.id,
                title: data.title || 'No Title',
                mean: docMean,
                variance: docVar,
                distance: distance
            });
        });

        // nearest sort & get result
        docsWithDistance.sort((a, b) => a.distance - b.distance);
        const nearestDocs = docsWithDistance.slice(0, n);

        const formattedResults = nearestDocs.map(doc => ({
            id: doc.id,
            title: doc.title
        }));

        console.log(`find ${nearestDocs.length} data:`, nearestDocs);

        // log console
        console.group('similarity results');
        nearestDocs.forEach((doc, index) => {
            console.log(`${index + 1} place: ID=${doc.id}, Title=${doc.title}, Distance=${doc.distance.toFixed(4)}`);
        });
        console.groupEnd();

        console.log('Sorted results in JSON format:');
        console.log(JSON.stringify(formattedResults, null, 2));

        // return jason & nearest
        return {
            nearest: nearestDocs.length > 0 ? nearestDocs[0] : null,
            sortedResults: formattedResults
        };
    } catch (error) {
        console.error('Firestoreからの検索中にエラーが発生しました:', error);
        return {
            nearest: null,
            sortedResults: []
        };
    }
}