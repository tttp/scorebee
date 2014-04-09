$.mobile.hashListeningEnabled = false;
$.mobile.pushStateEnabled = false;



var tplPopup = null;
var tplScore = null;
var ndx = null; //workaround for now...

jQuery(function($){
$("#search-input").keyup (function () {
  var s = $(this ).val().toLowerCase();
  wall.dimension().filter(function (d) { return d.indexOf (s) !== -1;} ); 
  $(".resetall").attr("disabled",true);
  dc.redrawAll();
  console.log ($(this ).val());
});

  tplPopup = _.template ($("#infobox_tpl").text());
  tplScore = _.template ($("#score_tpl").text());

  $(".resetall").click(function() {
    $("#search-input").val("");
    $(".resetall").attr("disabled",false);
    dc.filterAll(); 
    dc.renderAll();
  });
});


var eu_groups = {
"GUE/NGL":"#df73be",
"S&D":"#ec2335",
"Verts/ALE":"#67bd1b",
"ALDE":"#f1cb01",
"EFD":"#60c0e2",
"PPE":"blue",
"EPP":"blue",
"ECR":"darkblue",
"NA/NI":"grey",
"Array":"pink"
};

var scoreCard = function (list_votes) {

var votes = function (all) {
  this.all = all;// votes to be taken into account. [dbid] is the voteid key
  this.index = {}; // column number in the cvs of a voteid
  this.mepindex = {}; //row number in the csv of a mepid
  this.type = {1:"for","-1":"against",0:"abstention","X":"absent","":"not mep"};
  this.direction = {1:"up","-1":"down"}; 
  _.each (all, function(v,i) {
    v.pro = v.against = v.abstention = v.absent = v["not mep"] = 0;
    v.date = new Date (v.date);
    if (typeof v.dbid !== "undefined") {
      this.index[v.dbid] = i;
    }

  },this);
};

votes.prototype.get = function (id) { //return the detail of a vote based on its id
  if (this.index[id])
    return this.all[this.index[id]];
  return null;// asking for a vote that doesn't exist
}

votes.prototype.setRollCall = function (rolls) {
  //var type = {1:"for","-1":"against",0:"abstention","X":"absent","":"not mep"};

  this.rollcalls = rolls;
  _.each (rolls, function(v,i) {
    var mep =v;
    this.mepindex[v.mep] = i;
    _.each(this.all, function (vote,id) {
      ++vote[this.type[mep[vote.dbid]]]; //type is one of pro against abstention absent
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
vote.weight = 1;
    }, this);
  
}

votes.prototype.getEffort = function (mepid) {
  var effort = 0; nbvote = 0;
  if (! this.exists(mepid)) {
    console || Console.log ("mep missing "+ mepid);
    return 0;//we don't have that mep?
  }
  var mep = this.rollcalls[this.mepindex[mepid]];
  _.each(this.all, function (vote) {
    if (mep[vote.dbid]) { // skip the vote the mep wasn't an mep 
      ++nbvote;
      if (Math.abs(mep[vote.dbid]) == 1) // yes or no
        ++effort;
      if (mep[vote.dbid] == 0) ++effort; //count abstention as effort
    }
  },this);
  return effort/nbvote * 100; 
}

votes.prototype.exists = function (mepid) {
  return this.mepindex.hasOwnProperty(mepid);
}

votes.prototype.getVotes = function (mepid) {
  if (! this.exists(mepid)) {
    console || console.log ("mep missing "+ mepid);
    return {};//we don't have that mep?
  }
  return this.rollcalls[this.mepindex[mepid]];
}

votes.prototype.getScore = function (mepid) {
  var score = nbvote = 0;
  if (! this.mepindex[mepid]) {
    console || console.log ("mep missing "+ mepid);
    return 50;//we don't have that mep?
  }
  var mep = this.rollcalls[this.mepindex[mepid]];
  _.each(this.all, function (vote) {
    if (mep[vote.dbid]) {
      nbvote = nbvote + vote.weight; //no weight used
      if ( mep[vote.dbid] == "X") { //abstention, we skip
        return;
      }
      score = score + vote.recommendation * mep[vote.dbid]*vote.weight;
    }
  },this);
  if (nbvote == 0) 
    return 50; // the dude wasn't around for the votes
//  return Math.floor (100*(score / nbvote)); // from -100 to 100
  return Math.floor (50 + 100*(score / nbvote)/2); // from 0 to 100
}
var vote = new votes (list_votes);

var topics = ["climate","gmo","topic 3","topic 4"];

var tpl = _.template("<div style='background-color:<%= color %>;' data-id='<% epid %>'><h2 title='MEP from <%= country %> in <%= eugroup %>'><%= first_name %> <%= last_name %></h2><div><img class='lazy-load' dsrc='blank.gif' data-original='http://www.europarl.europa.eu/mepphoto/<%= epid %>.jpg' alt='<%= last_name %>, <%= first_name %> member of <%= eugroup %>' title='MEP from <%= country %> in <%= eugroup %>' width=170 height=216 /><div class='score' style='font-size:<%= size %>px;'><%= score %></div></div><div class='party'><%= party %></div></div>");

var tplGroup = function (d) {
    return "<div class='dc-grid-group nodc-grid-item country_"+getCountryKey(d.key)+"'><h1 class='dc-grid-label'>"+d.key+"</h1></div>";
};

var getMEP = function (id) {
    for (var i in meps) {
      if (meps[i].epid === id)
        return meps[i];
    }
  }


function grid (selector) {
  adjust (meps);

  ndx = crossfilter(meps);//global.
  var    all = ndx.groupAll();

  function getScore (mep) {
    return vote.getScore (mep.epid);
  }

  // color based on the score.
  var color = d3.scale.linear()
    .clamp(true)
    .domain([0, 49, 50, 51, 100])
    .range(["#CF1919","#FA9B9B","#ccc","#d0e5cc","#2C851C"])
    .interpolate(d3.interpolateHcl);

  function adjust (data) {
    //calculate age
    var dateFormat = d3.time.format("%Y-%m-%d");
    var now = Date.now();
    var empty = [];
    data.forEach(function (e,i) { // remove the meps that have no votes
      if (!vote.exists(e.epid)) {
        empty.unshift (i);
      }
    });
    empty.forEach(function (i) { 
      meps.splice(i, 1);
    });
    data.forEach(function (e,i) {
      e.effort = vote.getEffort (e.epid);
      e.scores = [getScore(e),getScore(e),getScore(e),getScore(e)];
      e.birthdate = dateFormat.parse(e.birthdate);
      e.age= ~~((now - e.birthdate) / (31557600000));// 24 * 3600 * 365.25 * 1000
    });
  }


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
    .width(140)
    .height(140)
    .dimension(gender)
    .label(function (d){
        return SymbolGender[d.key];
        })
  .title(function (d){
      return NameGender[d.key] +": "+d.value;
      })
  .group(groupGender);

  var score = ndx.dimension (function(d) {
      return d.scores[0];
      });
  var scoreGroup = score.group().reduceSum (function(d) { return 1;});
  var bar_score = dc.barChart (".bar_score")
    .width(245)
    .height(130)
    .outerPadding(5)
    .gap(0)
    .margins({top: 10, right: 10, bottom: 20, left: 30})
    .x(d3.scale.linear().domain([0, 101]))
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
      if (nb) {
        var avg= total/nb;
        $(".bar_score div#avg_score").text(Math.round(avg));
      } else {
        $(".bar_score div#avg_score").text("");
      }
      //why doesn't it work? if (chart.dimension().size() !== chart.group().value()) {
      if (ndx.size() !== nb) {
         $(".resetall").attr("disabled",false);
      } else {  
        $(".resetall").attr("disabled",true);
      }
    });

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
  .width(600)
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
    .group(countryGroup)
    .on("postRender", function(c) {
      adjustBarChartLabels(c);
      c.svg().selectAll("rect.bar")
        .on("click.scroll", function( d ){
           scrollTo(d.data.key);
        });
    });

  function adjustBarChartLabels(chart) {
    chart.svg().selectAll('.axis.x text')
      .on("click",function(d) { 
        chart.filter(d);
        dc.redrawAll();
        scrollTo(d);
      })
      .style("text-anchor", "end" )      
      .attr("transform", function(d) { return "rotate(-90, -4, 9) "; });
  }


  chartParty (selector, ndx, color);
  chartGroup  (selector, ndx, color);


  dc.dataCount(".dc-data-count")
    .dimension(ndx)
    .group(all);

  var name = ndx.dimension(function(d) {
      return d.first_name.toLowerCase() + " "+ d.last_name.toLowerCase() + " " + d.party.toLowerCase();
      });

  wall = dc.dataGrid(".dc-data-grid")
    .dimension(name)
    .group(function (d) {
        return d.country;
        })
  .size(1000)
    .html (function(d) { 
        d.score = d.scores [0];
        d.color = color(d.score);
        d.size = 20+ 20*d.effort/100;

        return tpl(d);
        })
  .htmlGroup(function (d) {return tplGroup(d);})
  .sortBy(function (d) {
      return d.last_name;
      })
  .order(d3.ascending)
    .renderlet(function (grid) {
      grid.selectAll (".dc-grid-item")
        .on('click', function(d) {
          d.votes=vote.getVotes(d.epid);

          var v = {d:vote.all};
          _.each (v.d, function(x) { x.mep = d.votes[x.dbid];
             x.direction = vote.direction [x.mep];
             if (x.mep == "") {
               x.type ="not mep";
               return;
             } 
             if (x.mep == "X") {
               x.type ="absent";
               return;
             } else {
               x.type = vote.type [x.mep*x.recommendation];
             }
          });

          $( "#infobox").modal('show');
          $( ".infobox_content" ).html(tplPopup(d) + tplScore(v) );
        });
        $("img.lazy-load").lazyload ({effect : "fadeIn"})
        .removeClass("lazy-load");
        });



  dc.renderAll();
  var hash = window.location.hash;
   if(hash.indexOf('#mep') === 0) { 
     var mep = getMEP (hash.substring(4));
     mep.votes=vote.getVotes(mep.epid);
     $( "#infobox" ).html(tplPopup(mep)).modal( "show" );
   } else if (hash.length == 3){ //country
      var iso=hash.substring(1);

//      bar_country.filter (); 
   }
   
}


function getCountryKey (name) {
   return name.replace(/ /g,"_").toLowerCase();
}

function scrollTo (id) {
  $("#collapseOne").collapse("show");
  jQuery('html, body').animate({
    scrollTop: jQuery(".country_"+getCountryKey(id)).offset().top
  }, 2000);
};


function chartGroup (selector,ndx,color) {
  var chart = dc.pieChart(selector +  " .group").innerRadius(20).radius(70);
  var dimension = ndx.dimension(function(d) {
    if (typeof d.eugroup == "undefined") return "";
    return d.eugroup;
  });
  var group   = dimension.group().reduce(
    function(a,d) {a.count +=1; a.score +=d.scores[0]; a.effort += d.effort; return a; },
    function(a,d) {a.count -=1; a.score -=d.scores[0]; a.effort -= d.effort; return a; },
    function() {return {count:0,score:0,effort:0}; }
  ).order(function (p) {return p.count});

 var tip = d3.tip()
    .attr('class', 'd3-tip')
    .html(function(p) { return '<span><h2>' +  p.data.key + "</h2><ul>" + 
                "<li>MEPs: " +p.data.value.count + "</li>" +
                "<li>effort: " +Math.floor (p.data.value.effort/p.data.value.count) + "</li>" +
                "<li>score: "+Math.floor (p.data.value.score/p.data.value.count); 
       '</li></ul></span>' })
    .offset([-12, 0])


  chart
    .width(140)
    .height(140)
    .dimension(dimension)
    .valueAccessor (function(d) {
      return d.value.count;
    })
    .colorCalculator(function(d, i) {
      return eu_groups[d.key];
      //return color(d.value.score/d.value.count);
    })
    .group(group)
    .on("postRender", function(c) {
      c.svg().selectAll ("path")
        .call(tip)
        .on('mouseover', function(d) {
          tip.attr('class', 'd3-tip animate').show(d)
        })
        .on('mouseout', function(d) {
          tip.attr('class', 'd3-tip').show(d)
          tip.hide()
        })
    } );
}

function chartParty (selector, ndx, color) {
  var bubble_party = dc.bubbleChart(selector + " .party");
  var party = ndx.dimension(function(d) {
      if (typeof d.party == "undefined") return "";
      return d.party;
      });
 var tip = d3.tip()
    .attr('class', 'd3-tip')
    .html(function(p) { return '<span><h2>' +
        p.key + "</h2><ul>" + 
                "<li>MEPs: " +p.value.count + "</li>" +
                "<li>effort: " +Math.floor (p.value.effort/p.value.count) + "</li>" +
                "<li>score: "+Math.floor (p.value.score/p.value.count); 
       '</li></ul></span>' })
    .offset([-12, 0])


  var partyGroup   = party.group().reduce(
      function(a,d) {a.count +=1; a.score +=d.scores[0]; a.effort += d.effort; return a; },
      function(a,d) {a.count -=1; a.score -=d.scores[0]; a.effort -= d.effort; return a; },
      function() {return {count:0,score:0,effort:0}; }
      )
      .order(function (p) {return p.count});
  //  var countryScore   = country.group().reduceSum(function(d) { return d.scores[0]; });
  bubble_party
    .colorCalculator(function(d, i) {
        return color(d.value.score/d.value.count);
        })
  .valueAccessor (
      function(d) {
      return d.value.count;
      })
  .width(444)
    .height(240)
    .margins({top: 20, right: 20, bottom: 95, left: 30})
    .yAxisLabel("Effort")
    .xAxisLabel("Score")
    .dimension(party)
    .group(partyGroup)
    .keyAccessor(function (p) {
        return p.value.score/p.value.count;
    })
    .valueAccessor(function (p) {
        return p.value.effort/p.value.count;
    })
    .radiusValueAccessor(function (p) {
        return p.value.count;
    })
    .x(d3.scale.linear().domain([0, 100]))
    .r(d3.scale.linear().domain([0, 50]))
    .minRadiusWithLabel(15)
    .elasticY(false)
    .yAxisPadding(0)
    .elasticX(false)
    .xAxisPadding(0)
    .maxBubbleRelativeSize(0.15)
    .renderHorizontalGridLines(false)
    .renderVerticalGridLines(true)
    .renderLabel(false)
    .renderTitle(false)
    .on("postRender", function(c) {
      c.svg().selectAll ("circle")
        .call(tip)
        .on('mouseover', function(d) {
          tip.attr('class', 'd3-tip animate').show(d)
        })
        .on('mouseout', function(d) {
          tip.attr('class', 'd3-tip').show(d)
          tip.hide()
        })
    } );

  }

  this.vote = vote;
  this.grid = grid;
  return this;
};
