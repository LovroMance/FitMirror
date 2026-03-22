module.exports = {
  '*.{js,ts,vue}': ['eslint --fix', 'prettier --write'],
  '*.{css,scss,less}': ['stylelint --fix', 'prettier --write']
};
