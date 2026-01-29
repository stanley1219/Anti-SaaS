'use strict';

const { v4: uuidv4 } = require('uuid');

const requestId = (req, res, next) => {
    const headerName = 'X-Request-Id';
    const id = req.get(headerName) || uuidv4();

    req.id = id;
    res.set(headerName, id);
    next();
};

module.exports = requestId;
