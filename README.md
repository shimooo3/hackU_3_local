# hackU_3_local
マージ用に自身がローカルで動かしていた環境をそのまま上げました  
index.htmlのfirebase SDKとscoring.jsで使用しているfirestoreのコレクション名を変更してください．  
コレクションは以下の形式です．  
book_score/  
personal ID/  
title  
mean  
var  
  
scoring.js  
func image2vec  
画像を入力として受け取りRGB値を基にベクトルに変換し，平均と分散（stats）を返します．  
  
func image2vecDNN  
学習済みモデルを利用します．model.jsが必要です．  

func findNearestImageInFirestore  
image2vecで計算した平均と分散を用いてfirestore内の全データに対してユークリッド距離を求め上位n件を返します．  
  
home.js, index.html, style.cssはGPTを用いて表示用に作成しました．image2vec, image2vecDNNの使い分けはhome.js内でハードコーディングしているだけです．