var express = require('express');
var router = express.Router();
var geohash = require("geohash").GeoHash;
var common = require('../common');
var BvLocalAPI = common.load('bvLocalAPI');
var Logger = common.load('logger');
var request = require("request");
var rp = require('request-promise');
var pg = require('pg');
var geocoder = require('geocoder');
var Promise = require('bluebird');
var _ = require('underscore');

var getStarRating = function(ratingValue) {

              if(ratingValue >= 5)
              {
                return '<div class="rating"> Overall Rating  : ' +  '<span>☆</span><span>☆</span><span>☆</span><span>☆</span><span>☆</span> </div>'
              }
              else if(ratingValue >= 4 && ratingValue < 5)
              {
                               return '<div class="rating"> Overall Rating : '  +  '<span>☆</span><span>☆</span><span>☆</span><span>☆</span> </div>'
 
              }
              else if(ratingValue >= 3 && ratingValue < 4)
              {
                               return '<div class="rating"> Overall Rating : ' +  ' <span>☆</span><span>☆</span><span>☆</span> </div>'
 
              }
              else if(ratingValue >= 2 && ratingValue < 3)
              {
                               return '<div class="rating"> Overall Rating : '  +  ' <span>☆</span><span>☆</span> </div>'
 
              }
              else if(ratingValue >= 1 && ratingValue < 2)
              {
                               return '<div class="rating"> Overall Rating : ' +  ' <span>☆</span> </div>'
 
              }
}

var getAllRatings = function(reviewStats) {
  var ratingSplitup = '';
  if(reviewStats.RatingDistribution != null) {
    for(var i = 0; i < reviewStats.RatingDistribution.length; i++)
    {
      if(reviewStats.RatingDistribution[i].RatingValue === 5)
      {
        ratingSplitup += '<div class="rating">' + reviewStats.RatingDistribution[i].Count + '  : ' + ' <span>☆</span><span>☆</span><span>☆</span><span>☆</span><span>☆</span> </div>';
      }
      else if(reviewStats.RatingDistribution[i].RatingValue === 4)
      {
        ratingSplitup +=  '<div class="rating">' + reviewStats.RatingDistribution[i].Count + '  : ' + ' <span>☆</span><span>☆</span><span>☆</span><span>☆</span> </div>';
      }
      else if(reviewStats.RatingDistribution[i].RatingValue === 3)
      {
        ratingSplitup += '<div class="rating">' + reviewStats.RatingDistribution[i].Count + '  : ' + ' <span>☆</span><span>☆</span><span>☆</span> </div>';
      }
      else if(reviewStats.RatingDistribution[i].RatingValue === 2)
      {
        ratingSplitup += '<div class="rating">' + reviewStats.RatingDistribution[i].Count + '  : ' + ' <span>☆</span><span>☆</span></div>';
      }
      else if(reviewStats.RatingDistribution[i].RatingValue === 1)
      {
        ratingSplitup += '<div class="rating">' + reviewStats.RatingDistribution[i].Count + '  : ' + ' <span>☆</span> </div>';
      }
    }
  }
  return ratingSplitup;
}

var printBalloons = function(req, res, db_contact_info, review_ratings, markers) {
  // For each node, call this function , that gives the node
  var markers1 = [];
  var totalResults = 0;
  if (review_ratings.TotalResults != null)
    totalResults = review_ratings.TotalResults



  var reqs = db_contact_info.map(function (location, i) {
    var contact_info = location;
    var url = "http://maps.googleapis.com/maps/api/geocode/json?sensor=false&components=country:USA|postal_code:" + contact_info.postal_code;
    return rp({
      url: url,
      json: true
    })
  });

  Promise.all(reqs)
  .then(function (results) {

    return results.map(function (result, i) {
      var markers = [];
      var contact_info = db_contact_info[i];

      if (review_ratings.Results.length > 0 && result.results.length > 0) {
        var k = 0;

        while (review_ratings.Results[k] != null) {

          if (contact_info.node_account_name === review_ratings.Results[k].Id) {
            if(review_ratings.Results[k].FilteredReviewStatistics.AverageOverallRating != null && 
              review_ratings.Results[k].FilteredReviewStatistics.TotalReviewCount > 0)

            {
              console.log("Id : ", review_ratings.Results[k].Id);
              console.log("Rating : ", review_ratings.Results[k].FilteredReviewStatistics.AverageOverallRating );
              console.log("Total Review Count :", review_ratings.Results[k].FilteredReviewStatistics.TotalReviewCount);

              var ovrAllRating = review_ratings.Results[k].FilteredReviewStatistics.AverageOverallRating;
              var totalReviewCount = review_ratings.Results[k].FilteredReviewStatistics.TotalReviewCount;
              var ovrAllStarRating = getStarRating(ovrAllRating);
              var ratingsSplitup = getAllRatings(review_ratings.Results[k].FilteredReviewStatistics)

              var contentString = '<div id="content">' +
              '<div id="siteNotice"></div>' +
              '<h4 id="firstHeading" class="firstHeading">' + 'Store Address :  </h4>' +
              '<h4>' + contact_info.street_address + ',' + result.results[0].formatted_address + '</h4>' +
              '<div id="bodyContent">' +
              '<p><b>' + ovrAllStarRating + '</b>' + 
              '<p><b>Ratings Distribution : </b>' + ratingsSplitup +
              '<p><b>Total Review Count : </b> ' + totalReviewCount +
              '</div>' +
              '</div>';

              // Now, fill the marker structure
              //console.log(contentString);
              var lati = result.results[0].geometry.location.lat;
              var longi = result.results[0].geometry.location.lng;
              var fa = result.results[0].formatted_address;
              console.log(lati, longi);

              markers.push({
                fa: fa,
                lat: lati,
                lng: longi,
                contentString: contentString
                });
            }
          }
          k++;
        }
      }
      return markers;


    });
}).then(function (markers) {
  var _m = _.flatten(markers);

  res.render('../views/maplocv4.ejs', { lps:_m });
});

}

getReviewsAndRatings = function(req, res, hub, markers) {
  var url = "http://qa.api.bazaarvoice.com/data/products.json?PassKey=" +
  hub.apiKey +
  "&ApiVersion=5.4" +
  "&filteredstats=reviews&limit=100";

  console.log(url);
  // console.log(hub.id);
  request({
    url: url,
    json: true
  }, function(error, response, result) {
    getContactInfo(req, res, result, hub, markers);
  });
}

getContactInfo = function(req, res, result, hub, markers) {

  var db_results = [];

  var client = new pg.Client("postgresql://username:password@host:port/dbname");
  client.connect();
  var query = client.query("select * from node_account_contact_info where hub_account_id=$1", [hub.id]);
  query.on('row', function(row) {
    db_results.push(row);
  });
  query.on('end', function() {
    client.end();
    // console.log(db_results);
    // console.log(results);
    console.log(" Print Balloons Called ");
    printBalloons(req, res, db_results, result, markers);

  });
}

router.get("/:hubName", function(req, res) {

  var markers = [];
  log = Logger({
    level: 'debug',
    serviceName: 'geobrand'
  });

  bvLocalAPI = new BvLocalAPI({
    environment: 'qa',
    logger: log
  });

  //Request node accounts only for those nodes that have reviews
  //We have to get the passkey for the hub
  bvLocalAPI.hubWithName(req.params['hubName'], function(_err, hub) {


    // console.log(hub);
    getReviewsAndRatings(req, res, hub, markers);
  });

});


module.exports = router;
