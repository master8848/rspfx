'use strict';

const build = require('@microsoft/sp-build-web');
const { addFastServe } = require('spfx-fast-serve-helpers');
addFastServe(build);

build.initialize(require('gulp'));
