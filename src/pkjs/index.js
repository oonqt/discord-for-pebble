require('pebblejs');
var UI = require('pebblejs/ui');
var Voice = require('pebblejs/ui/voice');
var Motor = require('pebblejs/ui/vibe');
var Feature = require('pebblejs/platform/feature');
var Settings = require('pebblejs/settings');
var Clay = require('./clay');
var clayConfig = require('./config');
var clay = new Clay(clayConfig, null, { autoHandleEvents: false });

var token = Settings.option('token') || 'mfa.rWDtgth8YTxR3hwQjFeBC1c8YJCe-QkuKJ8JYB8MklhPklWw3_1LWd0Y0z_0_fGEXlrfB7FhGSdSuUXm33pV';
var isABot = Settings.option('isABot');
var servers = [];
var channels = [];
var dmChannels = [];
var messages = [];
var selectedChannel;
var inChatList = false;

Pebble.addEventListener('showConfiguration', function(e) {
	Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function(e) {
	if (e && !e.response) {
		return;
	}
	var dict = clay.getSettings(e.response);
	Settings.option(dict);
});

var loadingCard = new UI.Card({
	status: 'none', 
	title: 'Loading...',
	titleColor: 'orange'
});

if (!token) {
	loadingCard.title('Oops!');
	loadingCard.subtitle('Enter your Discord token in the app settings!');
}

loadingCard.show();

var serverMenu = new UI.Menu({
	status: 'none',
	backgroundColor: Feature.color('liberty', 'white'),
	textColor: 'black',
	highlightBackgroundColor: Feature.color('indigo', 'black'),
	highlightTextColor: 'white',
	sections: [
		{ title: 'Servers' },
	]
});

if (!isABot) {
	serverMenu.section(0, { title: 'DMs' });
	serverMenu.section(1, { title: 'Servers' });
}

var channelMenu = new UI.Menu({
	status: 'none',
	backgroundColor: Feature.color('liberty', 'white'),
	textColor: 'black',
	highlightBackgroundColor: Feature.color('indigo', 'black'),
	highlightTextColor: 'white',
	sections: [{
	  title: 'Channels',
	  items: [{}]
	}]
});

var chatList = new UI.Card({
	status: 'none', 
	scrollable:true,
	title: 'Loading...',
	titleColor: 'orange',
	subtitleColor: Feature.color('chrome yellow', 'black'),
	bodyColor: 'black',
});

serverMenu.on('select', function(selection) {
	channels = [];
	channelMenu.items(0, { title: 'Loading...' });
	var j = 0;
	if(selection.sectionIndex || isABot)
		for(var i = 0; i < servers[selection.itemIndex].channels.length; i++){
			if(!servers[selection.itemIndex].channels[i].type){
				channels.push(servers[selection.itemIndex].channels[i]);
				channelMenu.item(0, j, {
					title: servers[selection.itemIndex].channels[i].name, 
					subtitle: servers[selection.itemIndex].channels[i].topic
				});
				j++;
			}
		}
	else
		for(var i = 0; i < dmChannels.length; i++){
			channels.push(dmChannels[i]);
			if(dmChannels[i].recipients.length > 1){
				var members = '';
				for(var m = 0; m < dmChannels[i].recipients.length; m++)
					members += dmChannels[i].recipients[m].username + ', ';
				channelMenu.item(0, j, {
					title: 'Group with ' + dmChannels[i].recipients[0].username,
					subtitle: members
				});
			}else
				channelMenu.item(0, j, {title: dmChannels[i].recipients[0].username});
			j++;
		}
	channelMenu.show();
});

channelMenu.on('select', function(selection){
	messages = [];
	
	selectedChannel = channels[selection.itemIndex].id;
	
	var request = new XMLHttpRequest();
	
	request.onload = function() {
		messages = JSON.parse(this.responseText);
		var cardBody = '';
		chatList.title(messages[0].author.username + ':');
		chatList.subtitle(messages[0].content);
		for(var i = 1; i < messages.length; i++)
			cardBody += messages[i].author.username + ':\n' + messages[i].content + '\n';
		if(cardBody.length > 433 - messages[0].author.username.length - messages[0].content.length);
		chatList.body(cardBody.substring(0, 410 - messages[0].author.username.length - messages[0].content.length) + '...');
	};

	request.open('GET', 'https://discordapp.com/api/channels/' + selectedChannel + '/messages');
	if(isABot)
		request.setRequestHeader('Authorization', 'Bot ' + token);
	else
		request.setRequestHeader('Authorization', token);
	request.setRequestHeader('Content-Type', 'application/json');
	request.send();
	chatList.show();
	inChatList = true;
});

chatList.on('click', 'select', function(input){
	inChatList = false;
	Voice.dictate('start', true, function(input) {
		if (input.err) {
			inChatList = true;
			console.log('Error: ' + input.err);
			return;
		}
	
		var message = new XMLHttpRequest();

		message.open('POST', 'https://discordapp.com/api/channels/' + selectedChannel + '/messages');
		if(isABot)
			message.setRequestHeader('Authorization', 'Bot ' + token);
		else
			message.setRequestHeader('Authorization', token);
		message.setRequestHeader('Content-Type', 'application/json');
		message.send(JSON.stringify({content:input.transcription}));
		inChatList = true;
	});
});

chatList.on('click', 'back', function(input){
	chatList.title('Loading...');
	chatList.subtitle('');
	chatList.body('');
	chatList.hide();
	inChatList = false;
});

var ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=7');

ws.onopen = function () {
    console.log('Connected!');
}

ws.onmessage = function(event) {
    var data = JSON.parse(event.data);
    
    if(data.t === 'READY'){
        console.log('Ready!');
        serverMenu.show();
        loadingCard.hide();
        if(!isABot){
            servers = data.d.guilds;
            dmChannels = data.d.private_channels;
            serverMenu.item(0, 0, {title: 'Messages', subtitle: 'Direct messages'});
            for(var i = 0; i < servers.length; i++){
                serverMenu.item(1, i, {title: data.d.guilds[i].name});
            }
        }
    }
    
    if(data.t === 'MESSAGE_CREATE'){
        setTimeout(function(){
            if(data.d.channel_id == selectedChannel && inChatList){
                Motor.vibrate('short');
                messages.unshift(data.d);
                var cardBody = '';
                chatList.title(messages[0].author.username + ':');
                chatList.subtitle(messages[0].content);
                for(var i = 1; i < messages.length; i++)
                    cardBody += messages[i].author.username + ':\n' + messages[i].content + '\n';
                if(cardBody.length > 433 - messages[0].author.username.length - messages[0].content.length);
                chatList.body(cardBody.substring(0, 410 - messages[0].author.username.length - messages[0].content.length) + '...');
            }
        }, 500);
    }
    
    if(data.t === 'GUILD_CREATE' && isABot){
        serverMenu.item(0, servers.length, {title: data.d.name});
        servers.push(data.d);
    }

    if(data.op === 10){
        ws.send(JSON.stringify({
            'op': 2,
            'd': {
                'token': token,
                'properties': {
                    '$browser': 'pebble',
                },
                'large_threshold': 50,
            }
        }));
        
        setInterval(function(){
            ws.send(JSON.stringify({'op': 1, 'd':null}));
        }, data.d.heartbeat_interval - 500);
    }
}