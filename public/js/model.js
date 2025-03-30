/**
 * TensorFlow.jsを使用した画像特徴抽出モデルの管理
 */

// モデルの状態を管理する変数
let model = null;
let isModelLoading = false;
let modelLoadingListeners = [];

// モデルファイルパス
const LOCAL_MODEL_PATH = 'models/mobilenet/model.json';
const REMOTE_MODEL_PATH = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json';

/**
 * 学習済みモデルを読み込む関数
 * @return {Promise} モデル読み込みのPromise
 */
async function loadModel() {
    if (model !== null) {
        console.log('loaded');
        return model;
    }

    if (isModelLoading) {
        console.log('loading ...');
        return new Promise((resolve) => {
            modelLoadingListeners.push(() => resolve(model));
        });
    }

    isModelLoading = true;
    console.log('start loading');

    try {
        let modelPath = REMOTE_MODEL_PATH;

        try {
            const response = await fetch(LOCAL_MODEL_PATH, { method: 'HEAD' });
            if (response.ok) {
                console.log('found local');
                modelPath = LOCAL_MODEL_PATH;
            } else {
                console.log('not found local, use remote model');
            }
        } catch (error) {
            console.log('no local, use remote model', error);
        }

        console.log(`loading model: ${modelPath}`);
        model = await tf.loadLayersModel(modelPath);
        console.log('complete loading', model);

        const layer = model.getLayer('conv_pw_13_relu');
        model = tf.model({
            inputs: model.inputs,
            outputs: layer.output
        });

        console.log('model ready');

        isModelLoading = false;
        modelLoadingListeners.forEach(listener => listener());
        modelLoadingListeners = [];

        return model;
    } catch (error) {
        console.error('error in model load:', error);
        isModelLoading = false;
        throw error;
    }
}

/**
 * 画像を前処理する関数
 * @param {HTMLImageElement} image 画像要素
 * @return {tf.Tensor} 前処理された画像テンソル
 */
function preprocessImage(image) {
    return tf.tidy(() => {
        let tensor = tf.browser.fromPixels(image);

        // resize for model input (MobileNet 224x224)
        tensor = tf.image.resizeBilinear(tensor, [224, 224]);
        tensor = tensor.expandDims(0);
        tensor = tensor.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1));

        return tensor;
    });
}

/**
 * モデルを使用して特徴ベクトルを抽出する関数
 * @param {HTMLImageElement} image 画像要素
 * @return {Promise<Float32Array>} 特徴ベクトルデータ
 */
async function extractFeatures(image) {
    if (!model) {
        await loadModel();
    }
    const preprocessedImage = preprocessImage(image);
    const features = await model.predict(preprocessedImage);
    const featuresData = await features.data();

    preprocessedImage.dispose();
    features.dispose();

    return featuresData;
}