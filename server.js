// importing packages
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const errorhandler = require('errorhandler');
const apiRouter = require('./api/api');
const artistsRouter = require('./api/artists');
const sqlite3 = require('sqlite3');
const seriesRouter = require('./api/series');

// creating issueRouter
const issueRouter = express.Router({mergeParams: true});

// creating Express app and port variables
const app = express();
const PORT = process.env.PORT || 4001

// finding database
const db = new sqlite3.Database(process.env.TEST_DATABASE || './database.sqlite');

// using middleware
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(errorhandler());
app.use(cors());

// checking for required fields
function required_fields (artist) {
    if (artist.name && artist.dateOfBirth && artist.biography) {
        return true;
    } else {
        return false;
    }
}

// mounting routers and adding router params
app.use('/api', apiRouter);
apiRouter.use('/artists', artistsRouter);
apiRouter.use('/series', seriesRouter);
seriesRouter.use('/:seriesId/issues', issueRouter);
artistsRouter.param('artistId', (req, res, next, artistId) => {
    db.get('SELECT * FROM Artist WHERE id = $id', {$id: artistId}, (err, artist) => {
        if (err) {
            next(err);
        } else {
            if (artist) {
                req.artist = artist;
                next();
            } else {
                res.status(404).send();
            }
        }
    })
});
seriesRouter.param('seriesId', (req, res, next, seriesId) => {
    db.get('SELECT * FROM Series WHERE id = $id', {$id: seriesId}, (err, series) => {
        if (err) {
            next(err);
        } else {
            if (series) {
                req.series = series;
                next();
            } else {
                res.status(404).send();
            }
        }
    })
});
issueRouter.param('issueId', (req, res, next, issueId) => {
    db.get('SELECT * FROM Issue WHERE id = $id', {$id: issueId}, (err, issue) => {
        if (err) {
            next(err);
        } else {
            if (!issue) {
                res.sendStatus(404);
            } else {
                next();
            }
        }
    });
});

// route handlers for artistsRouter
artistsRouter.get('/', (req, res, next) => {
    db.all('SELECT * FROM Artist WHERE is_currently_employed = 1', (err, artists) => {
        if (err) {
            next(err);
        } else {
            res.status(200).json({artists: artists});
        }
    });
});

artistsRouter.get('/:artistId', (req, res, next) => {
    res.status(200).json({artist: req.artist});
});

artistsRouter.post('/', (req, res, next) => {
    const artist = req.body.artist;
    if (required_fields(artist)) {
        if (!artist.is_currently_employed) {
            artist.is_currently_employed = 1;
        }
        db.run('INSERT INTO Artist (name, date_of_birth, biography, is_currently_employed) VALUES ($name, $dateOfBirth, $biography, $is_currently_employed)', {$name: artist.name, $dateOfBirth: artist.dateOfBirth, $biography: artist.biography, $is_currently_employed: artist.is_currently_employed}, function (err) {
            if (err) {
                next(err);
            } else {
                db.get('SELECT * FROM Artist WHERE id = $id', {$id: this.lastID}, (err, artist) => {
                    res.status(201).json({artist: artist});
                });
            }
        });
    } else {
        res.status(400).send();
    }
});

artistsRouter.put('/:artistId', (req, res, next) => {
    const artist = req.body.artist;
    if (required_fields(artist)) {
        if (!artist.is_currently_employed) {
            artist.is_currently_employed = 1;
        }
        const values = {
            $id: req.params.artistId,
            $name: artist.name,
            $dateOfBirth: artist.dateOfBirth,
            $biography: artist.biography,
            $is_currently_employed: artist.is_currently_employed
        };
        db.run('UPDATE Artist SET name = $name, date_of_birth = $dateOfBirth, biography = $biography, is_currently_employed = $is_currently_employed WHERE id = $id', values, function (err) {
            if (err) {
                next(err);
            } else {
                db.get('SELECT * FROM Artist WHERE id = $id', {$id: req.params.artistId}, (err, artist) => {
                    res.status(200).json({artist: artist});
                })
            }
        });
    } else {
        res.sendStatus(400);
    }
});

artistsRouter.delete('/:artistId', (req, res, next) => {
    db.run('UPDATE Artist SET is_currently_employed = 0 WHERE id = $id', {$id: req.params.artistId}, function (err) {
        if (err) {
            next(err);
        } else {
            db.get('SELECT * FROM Artist WHERE id = $id', {$id: req.params.artistId}, (err, artist) => {
                res.status(200).json({artist: artist});
            })
        }
    })
});

// route handlers for seriesRouter
seriesRouter.get('/', (req, res, next) => {
    db.all('SELECT * FROM Series', (err, series) => {
        if (err) {
            next(err);
        } else {
            res.status(200).json({series: series})
        }
    })
});

seriesRouter.get('/:seriesId', (req, res, next) => {
    res.status(200).json({series: req.series});
});

seriesRouter.post('/', (req, res, next) => {
    const series = req.body.series;
    if (series.name && series.description) {
        db.run('INSERT INTO Series (name, description) VALUES ($name, $description)', {$name: series.name, $description: series.description}, function (err) {
            if (err) {
                next(err);
            } else {
                db.get('SELECT * FROM Series WHERE id = $id', {$id: this.lastID}, (err, series) => {
                    res.status(201).json({series: series});
                })
            }
        });
    } else {
        res.sendStatus(400);
    }
});

seriesRouter.put('/:seriesId', (req, res, next) => {
    const series = req.body.series;
    if (!series.name || !series.description) {
        res.sendStatus(400);
    } else {
        db.run('UPDATE Series SET name = $name, description = $description WHERE id = $id', {$name: series.name, $description: series.description, $id: req.params.seriesId}, function (err) {
            if (err) {
                next(err);
            } else {
                db.get('SELECT * FROM Series WHERE id = $id', {$id: req.params.seriesId}, (err, series) => {
                    res.status(200).json({series: series});
                });
            }
        });
    }
});

seriesRouter.delete('/:seriesId', (req, res, next) => {
    db.get('SELECT * FROM Issue WHERE series_id = $id', {$id: req.params.seriesId}, (err, series) => {
        if (err) {
            next(err);
        } else {
            if (!series) {
                db.run('DELETE FROM Series WHERE id = $id', {$id: req.params.seriesId}, (err) => {
                    res.sendStatus(204);
                })
            } else {
                res.sendStatus(400);
            }
        }
    })
});

issueRouter.get('/', (req, res, next) => {
    const seriesId = req.params.seriesId;
    db.all('SELECT * FROM Issue WHERE series_id = $seriesId', {$seriesId: seriesId}, (err, issues) => {
        if (err) {
            next(err);
        } else {
            res.status(200).json({issues: issues});
        }
    })
});

issueRouter.post('/', (req, res, next) => {
    const issue = req.body.issue;
    if (issue.name && issue.issueNumber && issue.publicationDate && issue.artistId) {
        db.get('SELECT * FROM Artist WHERE id = $id', {$id: issue.artistId}, (err, artist) => {
            if (artist) {
                const values = {
                    $name: issue.name,
                    $issue_number: issue.issueNumber,
                    $publication_date: issue.publicationDate,
                    $artist_id: issue.artistId,
                    $series_id: req.params.seriesId
                }
                db.run('INSERT INTO Issue (name, issue_number, publication_date, artist_id, series_id) VALUES ($name, $issue_number, $publication_date, $artist_id, $series_id)', values, function (err) {
                    if (err) {
                        next(err);
                    } else {
                        db.get('SELECT * FROM Issue WHERE id = $id', {$id: this.lastID}, (err, issue) => {
                            res.status(201).json({issue: issue});
                        })
                    }
                })
            } else {
                res.sendStatus(400);
            }
        })
    } else {
        res.sendStatus(400);
    }
})

issueRouter.put('/:issueId', (req, res, next) => {
    const issue = req.body.issue;
    if (issue.name && issue.issueNumber && issue.publicationDate && issue.artistId) {
        const values = {
            $name: issue.name,
            $issue_number: issue.issueNumber,
            $publication_date: issue.publicationDate,
            $series_id: req.params.seriesId,
            $artist_id: issue.artistId,
            $id: req.params.issueId
        };
        db.run('UPDATE Issue SET name = $name, issue_number = $issue_number, publication_date = $publication_date, series_id = $series_id, artist_id = $artist_id WHERE id = $id', values, (err) => {
            if (err) {
                next(err);
            } else {
                db.get('SELECT * FROM Issue WHERE id = $id', {$id: req.params.issueId}, (err, issue) => {
                    res.status(200).json({issue: issue});
                })
            }
        })
    } else {
        res.sendStatus(400);
    }
});

issueRouter.delete('/:issueId', (req, res, next) => {
    db.run('DELETE FROM Issue WHERE id = $id', {$id: req.params.issueId}, (err) => {
        if (err) {
            next(err);
        } else {
            res.sendStatus(204);
        }
    })
});

// starting server
app.listen(PORT, () => {
    console.log('Listening on port ' + PORT);
});

// exporting Express app
module.exports = app;