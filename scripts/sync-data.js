// FitMirror 静态数据同步脚本
// 用于从 GitHub 拉取最新动作库/食谱库等静态数据

const https = require("https");
const fs = require("fs");
const path = require("path");

const files = [
  {
    url: "https://raw.githubusercontent.com/your-org/fitmirror-data/main/exercises.json",
    dest: path.join(__dirname, "../frontend/public/data/exercises.json"),
  },
  {
    url: "https://raw.githubusercontent.com/your-org/fitmirror-data/main/recipes.json",
    dest: path.join(__dirname, "../frontend/public/data/recipes.json"),
  },
  {
    url: "https://raw.githubusercontent.com/your-org/fitmirror-data/main/version.json",
    dest: path.join(__dirname, "../frontend/public/data/version.json"),
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

(async () => {
  for (const f of files) {
    try {
      await downloadFile(f.url, f.dest);
      console.log(`同步成功: ${f.dest}`);
    } catch (e) {
      console.error(`同步失败: ${f.dest}`, e);
    }
  }
})();
