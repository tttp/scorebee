var scoreCard = function () {

var votes = function (all) {
  this.all = all;
  this.index = {};
  this.mepindex = {};
  _.each (all, function(v,i) {
    v.pro = v.against = v.abstention = v.absent = 0;
    v.date = new Date (v.date);
    if (typeof v.dbid !== "undefined") {
      this.index[v.dbid] = i;
    }
  },this);
};

votes.prototype.get = function (id) {
  if (this.index[id])
    return this.all[this.index[id]];
  return null;// asking for a vote that doesn't exist
}

votes.prototype.setRollCall = function (rolls) {
  var type = {1:"pro","-1":"against",0:"abstention","":"absent"};
  this.rollcalls = rolls;
  _.each (rolls, function(v,i) {
    var mep =v;
    this.mepindex[v.mep] = i;
    _.each(this.all, function (vote,id) {
      ++vote[type[mep[vote.dbid]]];
    }, this);
  }, this);
  // coef calculation
    var max = 0, min = Infinity;
    _.each(this.all, function (vote) {
      vote.cast = vote.pro+vote.against+vote.abstention;
      vote.weight = Math.abs (vote.cast / (vote.against - vote.pro));
      if (min > vote.weight) min = vote.weight;
      if (max < vote.weight) max = vote.weight;
    }, this);
    _.each(this.all, function (vote) {
      vote.weight = 1+(vote.weight-min)/(max-min);
    }, this);
  
}

votes.prototype.getScore = function (mepid) {
  var score = nbvote = 0;
  if (! this.mepindex[mepid]) {
    console || console.log ("mep missing "+ mepid);
    return 0;//we don't have that mep?
  }
  var mep = this.rollcalls[this.mepindex[mepid]];
  _.each(this.all, function (vote) {
    if (mep[vote.dbid]) {
      nbvote = nbvote + vote.weight; //no weight used
      score = score + vote.recommendation * mep[vote.dbid]*vote.weight;
    }
  },this);
  if (nbvote == 0) 
    return 0; // the dude wasn't around for the votes
  return Math.floor (100*(score / nbvote));
}

var vote = new votes (climate_votes);

var topics = ["climate","gmo","topic 3","topic 4"];

var tpl = _.template("<div style='background-color:<%= color %>;'><div class='score'><%= score %></div><h2 title='MEP from <%= country %> in <%= eugroup %>'><%= first_name %> <%= last_name %></h2><img class='lazy-load' dsrc='blank.gif' data-original='http://ep.ngo.im/mepphoto/<%= epid %>.jpg' alt='<%= last_name %>, <%= first_name %> member of <%= eugroup %>' title='MEP from <%= country %> in <%= eugroup %>' width=170 height=216 /><div class='party'><%= party %></div></div>");

function grid (selector) {
  var ndx = crossfilter(meps),
      all = ndx.groupAll();

  function getScore (mep) {
    return vote.getScore (mep.epid);
    var min =-100, max = 100;
    return Math.floor(Math.random() * (max - min) + min);
  }

  // color based on the score.
  var color = d3.scale.linear()
    .clamp(true)
    .domain([-100, -1, 0, 1, 100])
    .range(["#b00000","#f4d8d8","#ccc","#d0e5cc","#3a6033"])
    .interpolate(d3.interpolateHcl);


  function adjust (data) {
    //calculate age
    var dateFormat = d3.time.format("%Y-%m-%d");
    var now = Date.now();
    data.forEach(function (e) {
        e.scores = [getScore(e),getScore(e),getScore(e),getScore(e)];
        e.birthdate = dateFormat.parse(e.birthdate);
        e.age= ~~((now - e.birthdate) / (31557600000));// 24 * 3600 * 365.25 * 1000
        });
  }

  adjust (meps);

  var pie_group = dc.pieChart(selector +  " .group").innerRadius(20).radius(70);
  var group = ndx.dimension(function(d) {
      if (typeof d.eugroup == "undefined") return "";
      return d.eugroup;
      });
  var groupGroup   = group.group().reduceSum(function(d) {   return 1; });

  //var chart_age = dc.barChart(selector + " .age");
  var chart_age = dc.lineChart(selector + " .age");

 var age = ndx.dimension(function(d) {
      if (typeof d.age == "undefined") return "";
      return d.age;
      });


var ageGroup   = age.group().reduceSum(function(d) {   return 1; });

  chart_age
    .width(444)
    .height(200)
    .margins({top: 0, right: 0, bottom: 95, left: 30})
    .x(d3.scale.linear().domain([20,100]))
    .brushOn(true)
    .renderArea(true)
    .elasticY(true)
    .yAxisLabel("#MEPs")
    .dimension(age)
    .group(ageGroup);


  var pie_gender = dc.pieChart(selector +  " .gender").radius(70);
  var gender = ndx.dimension(function(d) {
      if (typeof d.gender == "undefined") return "";
      return d.gender;
      });

  var groupGender   = gender.group().reduceSum(function(d) {   return 1; });


  var NameGender= {"M":"Male","F":"Female","":"missing data"};
  var SymbolGender= {"M":"\u2642","F":"\u2640","":""};


  pie_gender
    .width(200)
    .height(200)
    .dimension(gender)
    .label(function (d){
        return SymbolGender[d.key];
        })
  .title(function (d){
      return NameGender[d.key] +": "+d.value;
      })
  .group(groupGender);

  pie_group
    .width(200)
    .height(200)
    .dimension(group)
    .colorCalculator(function(d, i) {
      if (eu_groups[d.key])
        return eu_groups[d.key];
      return "pink";
    })
    .group(groupGroup)
    .renderlet(function (chart) {
        });

  var score = ndx.dimension (function(d) {
      return d.scores[0];
      });
  var scoreGroup = score.group().reduceSum (function(d) { return 1;});
  var bar_score = dc.barChart (".bar_score")
    .width(250)
    .height(200)
    .outerPadding(0)
    .gap(1)
    .margins({top: 10, right: 10, bottom: 20, left: 30})
    .x(d3.scale.linear().domain([-100, 100]))
    .elasticY(true)
    .round(dc.round.floor)
    .colorCalculator(function(d, i) {
        return color(d.key);
        })
    .dimension(score)
    .group(scoreGroup)
    .renderlet(function (chart) {
      if (!console || !console.log) return;
      var d = chart.dimension().top(Number.POSITIVE_INFINITY);
      var total = nb = 0;
      d.forEach (function (a) {
        ++nb;
        total += a.scores[0];
      }); 
      var avg= total/nb;
      console.log ("average:" + avg);
    });


  var party = ndx.dimension (function(d) {
      if (typeof d.party == "undefined") return "";
      return d.party;
      });

  var partyGroup = party.group().reduceSum (function(d) { 
      return 1;
      return d.scores[0];});

  pie_party =dc.pieChart(selector +  " .party").innerRadius(20).radius(70)
    .width(200)
    .height(200)
    .dimension(party)
    .colors(d3.scale.category10())
    .group(partyGroup)
    .renderlet(function (chart) {
        });

  /*  var bar_topic = dc.barChart (selector + ".topic");
      var topic = ndx.dimension (function(d) {
//        return do something;
      });
      var topicGroup = topic.group().reduceSum (function(d) { return 0.6;});
      bar_topic
      .width(200)
      .height(100)
      .outerPadding(0)
      .gap(1)
      .margins({top: 0, right: 0, bottom: 10, left: 30})
      .x(d3.scale.ordinal())
      .xUnits(dc.units.ordinal)
      .brushOn(false)
      .elasticY(true)
      .yAxisLabel("#topics")
      .dimension(topic)
      .group(topicGroup);
   */

  var bar_country = dc.barChart(selector + " .country");
  var country = ndx.dimension(function(d) {
      if (typeof d.country == "undefined") return "";
      return d.country;
      });
  var countryGroup   = country.group().reduce(
      function(a,d) {a.count +=1; a.score +=d.scores[0]; return a; },
      function(a,d) {a.count -=1; a.score -=d.scores[0]; return a; },
      function() {return {count:0,score:0}; }
      );
  //  var countryScore   = country.group().reduceSum(function(d) { return d.scores[0]; });
  bar_country
    .colorCalculator(function(d, i) {
        return color(d.value.score/d.value.count);
        })
  .valueAccessor (
      function(d) {
      return d.value.count;
      })
  .width(444)
    .height(200)
    .outerPadding(0)
    .gap(1)
    .margins({top: 10, right: 0, bottom: 95, left: 30})
    .x(d3.scale.ordinal())
    .xUnits(dc.units.ordinal)
    .brushOn(false)
    .elasticY(true)
    .yAxisLabel("#MEPs")
    .dimension(country)
    .group(countryGroup);

  bar_country.on("postRender", function(c) {rotateBarChartLabels();} );


  function rotateBarChartLabels() {
    d3.selectAll(selector+ ' .country .axis.x text')
      .style("text-anchor", "end" )
      .attr("transform", function(d) { return "rotate(-90, -4, 9) "; });
  }

  dc.dataCount(".dc-data-count")
    .dimension(ndx)
    .group(all);

  dc.dataGrid(".dc-data-grid")
    .dimension(country)
    .group(function (d) {
        return d.country;
        })
  .size(1000)
    .html (function(d) { 
        d.score = d.scores [0];
        d.color = color(d.score);

        return tpl(d);
        })
  .sortBy(function (d) {
      return d.last_name;
      })
  .order(d3.ascending)
    .renderlet(function (grid) {
        $("img.lazy-load").lazyload ({
effect : "fadeIn"
})
        .removeClass("lazy-load");
        });



dc.renderAll();
}

this.vote = vote;
this.grid = grid;
return this;
};
