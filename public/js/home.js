// 過去の画像データを保存する配列
const imageHistory = [];
// Firestoreのデータを保存する配列
const firestoreData = [];

let isEventSet = false; const imageInput = document.getElementById('imageInput');
const resultSection = document.getElementById('resultSection');
const hiddenImage = document.getElementById('hiddenImage');
const vectorCanvas = document.getElementById('vectorCanvas');
const loadingIndicator = document.getElementById('loadingIndicator');
const uploadLabel = document.querySelector('.upload-label');
const similarImageInfo = document.getElementById('similarImageInfo');

// モデルの初期化状態を管理するフラグ
let isModelInitialized = false;
// Firestoreデータ読み込み状態
let isFirestoreDataLoaded = false;

// DOMContentLoadedイベントよりも先に実行される初期化処理
(async function initializeModel() {
    console.log('モデルの初期化を開始します');
    try {
        showLoadingUI('DNNモデルを読み込み中...');
        await loadModel();
        console.log('モデルの初期化が完了しました');
        isModelInitialized = true;
        hideLoadingUI();
    } catch (error) {
        console.error('モデルの初期化中にエラーが発生しました:', error);
        hideLoadingUI();
        showErrorMessage('モデルの読み込みに失敗しました。ページを再読み込みしてください。');
    }
})();

// Firestoreからデータを読み込む関数
async function loadFirestoreData() {
    if (isFirestoreDataLoaded) return firestoreData;

    showLoading('Firestoreデータを読み込み中...');

    try {
        const collectionRef = db.collection('book_score');
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
            console.log('Firestoreに該当するデータがありません');
            hideLoading();
            return [];
        }

        // 既存のデータをクリア
        firestoreData.length = 0;

        // データの読み込み
        snapshot.forEach(doc => {
            const data = doc.data();
            firestoreData.push({
                id: doc.id,
                title: data.title || 'No Title',
                mean: parseFloat(data.mean) || 0,
                variance: parseFloat(data.var) || 0
            });
        });

        console.log(`Firestoreから${firestoreData.length}件のデータを読み込みました`);
        isFirestoreDataLoaded = true;
        hideLoading();

        return firestoreData;
    } catch (error) {
        console.error('Firestoreデータの読み込み中にエラーが発生しました:', error);
        hideLoading();
        showErrorMessage('Firestoreデータの読み込みに失敗しました: ' + error.message);
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    console.log('DOM ready');

    console.log('imageInput:', imageInput);
    console.log('resultSection:', resultSection);
    console.log('hiddenImage:', hiddenImage);
    console.log('vectorCanvas:', vectorCanvas);
    console.log('loadingIndicator:', loadingIndicator);
    console.log('similarImageInfo:', similarImageInfo);

    // モデルが既に初期化済みかチェック
    if (!isModelInitialized) {
        console.log('DOMContentLoaded時点でモデルが未初期化です。初期化を待機します。');
    }

    if (uploadLabel) {
        uploadLabel.addEventListener('click', () => {
            if (!isEventSet) {
                imageInput.addEventListener('change', handleImageSelection);
                isEventSet = true;
                console.log('ファイル選択イベント設定完了');
            }
            imageInput.click();
        });
    } else {
        console.error('upload-labelが見つかりません');
    }

    // Firestoreデータを読み込み
    await loadFirestoreData();

    // キャンバスの初期化（グリッド線を描画）とFirestoreデータ表示
    initializeCanvasWithFirestoreData();
});

// キャンバスを初期化し、Firestoreのデータを表示する関数
function initializeCanvasWithFirestoreData() {
    if (!vectorCanvas) return;

    const ctx = vectorCanvas.getContext('2d');
    const width = vectorCanvas.width;
    const height = vectorCanvas.height;

    // キャンバスをクリア
    ctx.clearRect(0, 0, width, height);

    // グリッド線を描画
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // 縦線
    for (let x = 0; x <= width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // 横線
    for (let y = 0; y <= height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // 中心線（強調表示）
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;

    // 縦の中心線
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // 横の中心線
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // 座標軸ラベル
    ctx.fillStyle = '#555';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('平均', width / 2, height - 5);
    ctx.textAlign = 'left';
    ctx.fillText('分散', 5, height / 2 - 10);

    // Firestoreのデータを描画
    drawFirestoreData(ctx, width, height);

    // 軸の目盛りを追加（正規化された値に合わせて）
    drawAxisLabels(ctx, width, height, 30);
}

// Firestoreのデータを描画する関数
function drawFirestoreData(ctx, width, height, padding = 30) {
    if (!firestoreData || firestoreData.length === 0) return;

    console.log('Firestoreデータを描画します', firestoreData.length, '件');

    // 各データポイントを描画
    for (let i = 0; i < firestoreData.length; i++) {
        const data = firestoreData[i];

        // キャンバス座標に変換
        const canvasX = padding + (width - 2 * padding) * data.mean;
        const canvasY = height - padding - (height - 2 * padding) * data.variance;

        // 点のスタイル
        ctx.fillStyle = 'rgba(52, 152, 219, 0.5)'; // 青色（半透明）
        ctx.strokeStyle = '#2980b9'; // 濃い青
        ctx.lineWidth = 1;

        // 小さい点を描画
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // ホバー時にタイトルを表示するために、データをキャンバスに関連付ける
        // (実際のホバー機能は実装していませんが、拡張としてコメントアウトで残しておきます)
        /*
        vectorCanvas.addEventListener('mousemove', function(e) {
            const rect = vectorCanvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // マウスが点の近くにあるかチェック
            const distance = Math.sqrt(Math.pow(mouseX - canvasX, 2) + Math.pow(mouseY - canvasY, 2));
            if (distance < 10) {
                // ツールチップを表示
                showTooltip(data.title, mouseX, mouseY);
            }
        });
        */
    }
}

async function handleImageSelection(event) {
    console.log('画像が選択されました');
    const file = event.target.files[0];
    if (!file) {
        console.error('ファイルが選択されていません');
        return;
    }

    if (!file.type.match('image.*')) {
        alert('画像ファイルを選択してください');
        return;
    }

    console.log('画像ファイルが選択されました:', file.name);
    showLoading('画像を処理中...');

    // モデルが初期化されているか確認
    if (!isModelInitialized) {
        console.log('モデルが初期化されていません。初期化を待機します。');
        try {
            await loadModel();
            isModelInitialized = true;
        } catch (error) {
            console.error('モデルの初期化中にエラーが発生しました:', error);
            hideLoading();
            alert('DNNモデルの読み込みに失敗しました。ページを再読み込みしてください。');
            return;
        }
    }

    // Firestoreデータがまだ読み込まれていない場合は読み込む
    if (!isFirestoreDataLoaded) {
        await loadFirestoreData();
    }

    const reader = new FileReader();

    reader.onerror = function (event) {
        console.error('ファイルの読み込み中にエラーが発生しました:', event);
        hideLoading();
    };

    reader.onload = function (e) {
        console.log('画像の読み込みが完了しました');

        // check image2vec function
        if (typeof image2vec !== 'function') {
            console.error('image2vec関数が定義されていません');
            hideLoading();
            return;
        }

        hiddenImage.onload = async function () {
            console.log('隠し画像の読み込みが完了しました');

            try {
                const emotion = "哀";

                const embeddingResult = await image2vec(hiddenImage, emotion);
                console.log('画像と感情から埋め込みベクトルを生成しました:', embeddingResult);

                console.log('感情オフセット適用後の座標:', {
                    emotion: emotion,
                    normalizedMean: embeddingResult.stats.normalizedMean,
                    normalizedVariance: embeddingResult.stats.normalizedVariance,
                    // グラフ表示，firestore格納用
                    x: embeddingResult.stats.x,
                    y: embeddingResult.stats.y
                });

                // 画像データと埋め込みベクトルを履歴に保存
                imageHistory.push({
                    filename: file.name,
                    embedding: embeddingResult,
                    timestamp: new Date().toISOString()
                });

                // firestore検索
                const searchResult = await findNearestImageInFirestore(embeddingResult.stats.x, embeddingResult.stats.y, 2);
                const nearestImage = searchResult.nearest;
                const sortedResults = searchResult.sortedResults;

                console.log('類似度順のソート結果:', sortedResults);

                // 結果表示関数を呼び出し
                displayResults(embeddingResult, nearestImage);
                hideLoading();
            } catch (error) {
                console.error('画像処理中にエラーが発生しました:', error);
                hideLoading();
                alert('画像処理中にエラーが発生しました: ' + error.message);
            }
        };
        hiddenImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function displayResults(embeddingResult = null, nearestImage = null) {
    console.log('結果を表示します');

    resultSection.style.display = 'block';

    // 最近傍画像の情報を表示
    if (similarImageInfo) {
        if (nearestImage) {
            similarImageInfo.innerHTML = `
                <p><strong>ID:</strong> ${nearestImage.id}</p>
                <p><strong>Title:</strong> ${nearestImage.title}</p>
                <p><strong>Distance:</strong> ${nearestImage.distance.toFixed(4)}</p>
            `;
        } else {
            similarImageInfo.textContent = '類似画像は見つかりませんでした';
        }
    }

    // 埋め込みベクトルの可視化
    if (embeddingResult && embeddingResult.vector) {
        visualizeImageWithFirestoreData(embeddingResult, nearestImage);
    }

    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// ローディング表示関数
function showLoading(message = '処理中...') {
    if (loadingIndicator) {
        const messageSpan = loadingIndicator.querySelector('span');
        if (messageSpan) {
            messageSpan.textContent = message;
        }
        loadingIndicator.style.display = 'flex';
    }

    // アップロードボタンを無効化
    if (uploadLabel) {
        uploadLabel.classList.add('disabled');
    }
}

// ローディング非表示関数
function hideLoading() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }

    // アップロードボタンを有効化
    if (uploadLabel) {
        uploadLabel.classList.remove('disabled');
    }
}

// エラーメッセージ表示関数
function showErrorMessage(message) {
    alert(message);
}

// UIのロード中表示関数（スクリプトロード時に使用）
function showLoadingUI(message) {
    // DOMがまだ読み込まれていない可能性があるため、要素を直接作成
    let loadingElement = document.getElementById('initialLoadingIndicator');

    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'initialLoadingIndicator';
        loadingElement.style.position = 'fixed';
        loadingElement.style.top = '0';
        loadingElement.style.left = '0';
        loadingElement.style.width = '100%';
        loadingElement.style.height = '100%';
        loadingElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        loadingElement.style.display = 'flex';
        loadingElement.style.flexDirection = 'column';
        loadingElement.style.alignItems = 'center';
        loadingElement.style.justifyContent = 'center';
        loadingElement.style.zIndex = '9999';
        loadingElement.style.color = '#3498db';
        loadingElement.style.fontSize = '18px';
        loadingElement.style.fontWeight = 'bold';

        const spinner = document.createElement('div');
        spinner.style.width = '50px';
        spinner.style.height = '50px';
        spinner.style.border = '5px solid rgba(52, 152, 219, 0.2)';
        spinner.style.borderTop = '5px solid #3498db';
        spinner.style.borderRadius = '50%';
        spinner.style.animation = 'spin 1s linear infinite';
        spinner.style.marginBottom = '15px';

        // アニメーションスタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        const messageElement = document.createElement('div');
        messageElement.textContent = message;

        loadingElement.appendChild(spinner);
        loadingElement.appendChild(messageElement);
        document.body.appendChild(loadingElement);
    } else {
        const messageElement = loadingElement.querySelector('div:not(:first-child)');
        if (messageElement) {
            messageElement.textContent = message;
        }
        loadingElement.style.display = 'flex';
    }
}

// UIのロード終了関数
function hideLoadingUI() {
    const loadingElement = document.getElementById('initialLoadingIndicator');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Firestoreデータと画像データを一緒に表示する関数
function visualizeImageWithFirestoreData(embeddingResult, nearestImage = null) {
    if (!vectorCanvas) return;

    const ctx = vectorCanvas.getContext('2d');
    const width = vectorCanvas.width;
    const height = vectorCanvas.height;
    const padding = 30; // グラフの余白

    // キャンバスを初期化し、Firestoreデータを描画
    initializeCanvasWithFirestoreData();

    // 最近傍の画像データを強調表示（存在する場合）
    if (nearestImage) {
        // 最近傍のポイントを緑色で強調表示
        const nearestX = padding + (width - 2 * padding) * nearestImage.mean;
        const nearestY = height - padding - (height - 2 * padding) * nearestImage.variance;

        // 緑色で円を描画
        ctx.fillStyle = 'rgba(46, 204, 113, 0.7)'; // 緑色（半透明）
        ctx.strokeStyle = '#27ae60'; // 濃い緑
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nearestX, nearestY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // タイトルを表示
        ctx.fillStyle = '#27ae60';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(nearestImage.title, nearestX, nearestY - 12);
    }

    // 最新の画像データを赤色で描画
    if (embeddingResult && embeddingResult.stats) {
        const stats = embeddingResult.stats;

        // 正規化された平均と分散を使用
        const normalizedMean = stats.x;
        const normalizedVariance = stats.y;

        // キャンバス座標に変換
        const imageX = padding + (width - 2 * padding) * normalizedMean;
        const imageY = height - padding - (height - 2 * padding) * normalizedVariance;

        // 赤色で円を描画
        ctx.fillStyle = 'rgba(231, 76, 60, 0.7)'; // 赤色（半透明）
        ctx.strokeStyle = '#c0392b'; // 濃い赤
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(imageX, imageY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 「Input Image」というラベルを表示
        ctx.fillStyle = '#c0392b';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Input Image', imageX, imageY - 15);
    }
}

// 軸の目盛りを描画する関数
function drawAxisLabels(ctx, width, height, padding) {
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';

    // X軸（平均）の目盛り
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i <= 1; i += 0.2) {
        const x = padding + (width - 2 * padding) * i;
        const label = i.toFixed(1);

        // 目盛り線
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, height - padding);
        ctx.lineTo(x, height - padding + 5);
        ctx.stroke();

        // ラベル
        ctx.fillText(label, x, height - padding + 8);
    }

    // Y軸（分散）の目盛り
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 1; i += 0.2) {
        const y = height - padding - (height - 2 * padding) * i;
        const label = i.toFixed(1);

        // 目盛り線
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding - 5, y);
        ctx.lineTo(padding, y);
        ctx.stroke();

        // ラベル
        ctx.fillText(label, padding - 8, y);
    }
}

// Firebaseが正しく初期化されていることを確認
if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.error('Firebase/Firestoreが初期化されていません。Firestore関連の機能は無効化されます。');
}