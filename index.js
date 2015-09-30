var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var schedule = require('node-schedule');
var moment = require('moment');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 3000;

var boardId = process.env.boardId;
var listToWatch = process.env.listToWatch;
var slackIncomingUrl = process.env.slackIncomingUrl;

app.head('/activity', function(req, res) {
	res.json({message: "Hello!"});
});

app.post('/activity', function(req, res) {
	console.log("Webhook payload incoming...");
  	var payload = req.body;
  	if(payload.action.type === "updateCard"
		&& payload.action.data.listAfter
		&& payload.action.data.listAfter.name === listToWatch)
	{
		var cardName = payload.action.data.card.name;
  		var updateDate = moment(payload.action.date);
		var minutesForAlert = getMinutesFromCardName(cardName);		
		if(minutesForAlert){			
			cardName = cardName.replace("["+minutesForAlert+"]","").trim();
			scheduleNewAlert(cardName, minutesForAlert, updateDate);	
			console.log("Reminder scheduled.");
		}
		alertSlackThatClassIsStarting(cardName, minutesForAlert);
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

function scheduleNewAlert(cardName, minutesForAlert, updateDate){
	console.log("Scheduling alert for " + cardName + "...");
	var alertDate = updateDate.add(minutesForAlert, 'minutes');
	var j = schedule.scheduleJob(alertDate.toDate(), function(){
		alertSlackThatClassIsFinished(cardName);
	});    
}

function alertSlackThatClassIsFinished(name){
	console.log("Alerting alertSlackThatClassIsFinished for " + name + "...");	
	var slack = getSlack();
	slack.notify("\"" + name + "\" is over. Time for the next thing!", function(err, result){
	    console.log("Message alertSlackThatClassIsFinished sent to slack.");	    
	});
}

function getSlack(){
	var Slack = require('node-slackr');
	var slack = new Slack(slackIncomingUrl,{
	  channel: "#ema-school",
	  username: "school-bot",
	  icon_url: "http://images.clipartpanda.com/bus-20clip-20art-school-bus4.png",	 
	});
	return slack;
}

function alertSlackThatClassIsStarting(name, minutes){
	console.log("Alerting alertSlackThatClassIsStarting for " + name + "...");	
	var slack = getSlack();
	var extra = minutes ? "I will remind you in " + minutes + " minutes when it is over." : " The class will be over when you finish."
	slack.notify("\"" + name + "\" is starting now. " + extra, function(err, result){
	    console.log("Message alertSlackThatClassIsStarting sent to slack.");	    
	});
}

app.listen(port, function(){
	console.log('Magic happens on port ' + port);
});

//cron jobs

// Every day at 5:00 am
// move cards