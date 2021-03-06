// unirest is a lightweight http request client library
var unirest = require('unirest');
var express = require('express');
var events = require('events');

var app = express();

app.use(express.static('public'));

// The args argument is an object containing arguments to provide in the query string of the endpoint
var getFromApi = function(endpoint, args) {
    // This event emitter will be used to communicate whether retrieving the info was successful
    var emitter = new events.EventEmitter();
    // The .qs method takes an object consisting of query strings and appends them to the url upon request
    unirest.get('https://api.spotify.com/v1/' + endpoint)
        .qs(args)
        .end(function(response) {
            // call our own end event after all the data has been received
            if (response.ok) {
                // attach the response body parsed by Unirest
                emitter.emit('end', response.body);
            }
            else {
                // attach the error code returned by Unirest
                emitter.emit('error', response.code);
            }
        });
    return emitter;
};

// When a user makes a request to /search/:name, make a request to the Spotify /search endpoint
app.get('/search/:name', function(req, res) {
    // remember, first argument is our endpoint, second is our object of query strings
    // the endpoint is: /search?q=<name>&limit=1&type=artist
    var searchForArtist = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    var onArtistSearchEnd = function(item) {
        var artist = item.artists.items[0];
        var searchForRelated = getFromApi('artists/' + artist.id + '/related-artists');

        var onSearchForRelatedEnd = function(list) {
            artist.related = list.artists;
            var count = 0;
            var totalRelatedArtists = artist.related.length;

            var lookupComplete = function() {
                if (count === totalRelatedArtists) {
                    res.json(artist);
                }
            };

            artist.related.forEach(function(relatedArtist) {
                var searchForTopTracks = getFromApi('artists/' + relatedArtist.id + '/top-tracks', {
                    country: 'US'
                });

                var onSearchForRelatedTracksEnd = function(trackList) {
                    relatedArtist.tracks = trackList.tracks;
                    count++;
                    lookupComplete();
                };

                searchForTopTracks.on('end', onSearchForRelatedTracksEnd);
                searchForTopTracks.on('error', onError);
            });
        };

        searchForRelated.on('end', onSearchForRelatedEnd);
        searchForRelated.on('error', onError);
    };

    var onError = function(code) {
        res.sendStatus(code);
    };

    searchForArtist.on('end', onArtistSearchEnd);
    searchForArtist.on('error', onError);
});

app.listen(8080);