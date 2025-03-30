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
    const MAX_VARIANCE = 0.25;

    const normalizedMean = normalizeValue(mean, MIN_MEAN, MAX_MEAN);
    const normalizedVariance = normalizeValue(variance, MIN_VARIANCE, MAX_VARIANCE);

    return {
        //　正規化前後の平均，分散を返す
        mean,
        variance,
        normalizedMean,
        normalizedVariance
    };
}

/**
 * 画像から埋め込みベクトルを生成
 * @param {HTMLImageElement} image target image
 * @param {number} dimensions ベクトルの次元数（デフォルト: 16）
 * @return {Object} 埋め込みベクトルとメタデータを含むオブジェクト
 */
function image2vec(image, dimensions = 16) {
    console.log('called image2vec func');

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
                    const featureValue = (r + g + b) / (3 * count)
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

        console.log('mean=', stats.mean, 'var=', stats.variance);
        console.log('norm mean=', stats.normalizedMean, 'norm var=', stats.normalizedVariance);

        return {
            vector: finalVector,
            metadata: metadata,
            stats: stats
        };
    } catch (error) {
        console.error('error in embedding vector:', error);
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
 * @param {Object} embeddingStats 入力画像の特徴統計量 (mean, variance)
 * @param {number} n 取得する最近傍の数 (デフォルト: 2)
 * @return {Promise<Array<Object>>} 最も近いN件のデータ（距離順）
 */
async function findNearestImageInFirestore(embeddingStats, n = 2) {
    if (!embeddingStats || typeof embeddingStats.mean !== 'number' || typeof embeddingStats.variance !== 'number') {
        console.error('invalid :', embeddingStats);
        return null;
    }

    try {
        const { mean, variance } = embeddingStats;
        console.log(`search firestore: mean=${mean}, variance=${variance}, n=${n}`);

        // collection name = 'book_score'
        const collectionRef = db.collection('book_score');
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
            console.log('no daat');
            return null;
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
                title: data.title,
                mean: docMean,
                variance: docVar,
                distance: distance
            });
        });

        // nearest sort
        docsWithDistance.sort((a, b) => a.distance - b.distance);

        // get n nearest
        const nearestDocs = docsWithDistance.slice(0, n);

        console.log(`find ${n} data:`, nearestDocs);

        // log console
        console.group('similarity results');
        nearestDocs.forEach((doc, index) => {
            console.log(`${index + 1} place: ID=${doc.id}, Title=${doc.title}, Distance=${doc.distance.toFixed(4)}`);
        });
        console.groupEnd();

        // return nearest 
        return nearestDocs.length > 0 ? nearestDocs[0] : null;
    } catch (error) {
        console.error('Firestoreからの検索中にエラーが発生しました:', error);
        return null;
    }
}