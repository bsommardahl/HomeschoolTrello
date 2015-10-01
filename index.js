var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var schedule = require('node-schedule');
var moment = require('moment');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 3000;

var trelloListDoing = process.env.trelloListDoing;
var trelloListDone = process.env.trelloListDone;
var trelloListToDo = process.env.trelloListToDo;
var trelloDeveloperKey = process.env.trelloDeveloperKey;
var trelloToken = process.env.trelloToken;
var trelloBoardName = process.env.trelloBoardName;

var slackIncomingUrl = process.env.slackIncomingUrl;
var slackChannel = process.env.slackChannel;

app.head('/activity', function(req, res) {
	res.json({message: "Hello!"});
});

app.post('/activity', function(req, res) {
	console.log("Webhook payload incoming...");
  	var payload = req.body;
  	if(payload.action.type === "updateCard"
		&& payload.action.data.listAfter
		&& payload.action.data.listAfter.name === trelloListDoing)
	{
		var cardName = payload.action.data.card.name;
  		var updateDate = moment(payload.action.date);
		var minutesForAlert = getMinutesFromCardName(cardName);	
		var alertDate = false;

		if(minutesForAlert){			
			cardName = cardName.replace("["+minutesForAlert+"]","").trim();
			alertDate = moment(updateDate).add(minutesForAlert, 'minutes');
			scheduleAlertForEndOfClass(cardName, alertDate);				
		}
	
		alertSlackThatClassIsStarting(cardName, alertDate);
		console.log("Notified of start.");
		res.json({ message: 'Thanks, Trello! Bye.' });   
	}
	else{
		console.log("Ignored.")
		res.json({ message: 'No thanks, Trello! That one isn\'t important to me.' });   
	}	
});

function getMinutesFromCardName(name){
	var regExp = /\[([^)]+)\]/;
	var matches = regExp.exec(name);
	if(!matches) return false;
	if(matches.length!=2) return false;
	console.log(name + " has " + matches[1] + " minutes.");
	return parseInt(matches[1]);
}

function scheduleAlertForEndOfClass(cardName, alertDate){
	console.log("End class alert scheduled.");	
	var j = schedule.scheduleJob(alertDate.toDate(), function(){
		alertSlackThatClassIsFinished(cardName);
	});    	
	var minutesTillAlert = moment().diff(alertDate, 'minutes') * -1;	
	var shouldWarn = minutesTillAlert > 15;
	if(shouldWarn){
		var warningDate = moment(alertDate).add(-5, 'minutes');	
		var r = schedule.scheduleJob(warningDate.toDate(), function(){
			alertSlackThatClassIsAlmostFinished(cardName);
		});    
		console.log("5-Minutes warning scheduled.");		
	}
}

function alertSlackThatClassIsFinished(name){
	console.log("Alerting alertSlackThatClassIsFinished for " + name + "...");	
	var slack = getSlack();
	slack.notify("\"" + name + "\" is *over*! Time for the next thing!", function(err, result){
	    console.log("Message alertSlackThatClassIsFinished sent to slack.");	    
	});
}

function alertSlackThatClassIsAlmostFinished(name){
	console.log("Alerting alertSlackThatClassIsAlmostFinished for " + name + "...");	
	var slack = getSlack();
	slack.notify("\"" + name + "\" is ALMOST over. You have `5 minutes` left.", function(err, result){
	    console.log("Message alertSlackThatClassIsFinished sent to slack.");	    
	});
}

function getSlack(){
	var Slack = require('node-slackr');
	var slack = new Slack(slackIncomingUrl,{
	  channel: slackChannel,
	  username: "school-bot",
	  icon_url: "http://images.clipartpanda.com/bus-20clip-20art-school-bus4.png",	 
	});
	return slack;
}

function alertSlackThatClassIsStarting(name, endTime){
	console.log("Alerting alertSlackThatClassIsStarting for " + name + "...");	
	var slack = getSlack();
	var extra = endTime ? "I will remind you at `" + endTime.format("h:mm a") + "` when it is over." : " The class will be over when you finish."
	slack.notify("\"" + name + "\" is starting now. " + extra, function(err, result){
	    console.log("Message alertSlackThatClassIsStarting sent to slack.");	    
	});
}

app.listen(port, function(){
	console.log('Magic happens on port ' + port);
});

// ################################
// TRELLO 
// ################################

var _ = require("underscore");
var Trello = require("node-trello");
var trello = new Trello(trelloDeveloperKey, trelloToken);

// Every day at 5:00 am
var j = schedule.scheduleJob({hour: 5, minute: 0, dayOfWeek: [1,2,3,4,5]}, function(){
	moveCards();
});

function moveCards(){
	console.log("Moving cards from " + trelloListDone + " to " + trelloListToDo + "...");
	trello.get("/1/members/me/boards", function(err, allBoards) {
	  if (err) throw err;
	  var boardSummary = _.find(allBoards, function(b){return b.name===trelloBoardName});
	  if(!boardSummary) throw new Error("Board not found.");
	  var boardId = boardSummary.id;
	  
	  trello.get("/1/boards/" + boardId + "/lists", function(errboard, lists){
  		if (errboard) throw errboard;
  		var todayList = _.find(lists, function(l){return l.name==trelloListToDo});
	  	if(!todayList) throw new Error("ToDo List not found.");
  		var doneList = _.find(lists, function(l){return l.name==trelloListDone});
		if(!doneList) throw new Error("Done List not found.");
  		
  		trello.get("/1/lists/" + doneList.id + "/cards", function(errCards, cards){
			if (errCards) throw errCards;	  	
			_.each(cards, function(c){
				trello.put("/1/cards/" + c.id + "/idList", {value: todayList.id}, function(errMove, moveResult){
					if (errMove) throw errMove;	  				
					console.log("- " + c.name);
				});	
			})  			
  		});
	  });	  
	});	
};