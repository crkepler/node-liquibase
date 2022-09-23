const {series, src, dest} = require('gulp');
const file = require('gulp-file');

const fs = require('fs-extra');
const path = require('path');

const clean = (cb) => {
    /**
     * Ensures that a directory is empty. Deletes directory contents if the directory is not empty. If the directory
     * does not exist, it is created. The directory itself is not deleted.
     */
    fs.emptyDirSync(path.resolve(__dirname, '..') + "/build");
    fs.emptyDirSync(path.resolve(__dirname, '..') + "/build/liquibase");
    fs.emptyDirSync(path.resolve(__dirname, '..') + "/build/logs");
    fs.emptyDirSync(path.resolve(__dirname, '..') + "/build/config");
    cb();
}

const copyFiles = () => {
    return src([
            './liquibase/**/*.yaml',
            './config/production.yml',
            'docker-compose.yml',
            'Dockerfile'
        ], {base: '.'})
        .pipe(file('./logs/activity.log', '{"level":"info","message": "started"}'))
        .pipe(dest('../build/'));
}


exports.clean = clean;
exports.default = series(clean, copyFiles);