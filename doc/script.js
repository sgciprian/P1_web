HOSTNAME = ""

async function fetchPower() {
	try {
		const response = await fetch(`${HOSTNAME}api/electricity/now`);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const [timestamp, power] = await response.json();
		const formattedTimestamp = formatTimestamp(timestamp);
		
		document.getElementById('timestamp').textContent = formattedTimestamp;
		document.getElementById('power').textContent = `${power.toFixed(0)} W`;
	} catch (error) {
		document.getElementById('timestamp').textContent = '';
		document.getElementById('power').textContent = 'Error fetching data';
		console.error('Error fetching power:', error);
	}
}

function formatTimestamp(timestamp) {
	const hour = timestamp.slice(6, 8);
	const minute = timestamp.slice(8, 10);
	const second = timestamp.slice(10, 12);
	
	return `${hour}:${minute}:${second}`;
}

async function fetchGraphData() {
	const now = new Date();
	const interval = 15 * 60 * 1000;
	const intervals = Math.ceil((24 * 60 * 60 * 1000) / interval);
	const graphData = [];
	
	const midnight = new Date();
	midnight.setHours(0, 0, 0, 0);
	
	const midnightYesterday = new Date();
	midnightYesterday.setDate(midnightYesterday.getDate() - 1);
	midnightYesterday.setHours(0, 0, 0, 0);
	
	fetchRequests = []
	requestDetails = []
	for (let i = 0; i < intervals; i++) {
		let start = new Date(midnight.getTime() + i * interval);
		let end = new Date(start.getTime() + interval);
		
		if (start <= now && end > now) {
			end = now;
		} else if (start > now) {
			start = new Date(midnightYesterday.getTime() + i * interval);
			end = new Date(start.getTime() + interval);
		}
		
		const startTimestamp = formatApiTimestamp(start);
		const endTimestamp = formatApiTimestamp(end);
		
		fetchRequests.push(fetch(`${HOSTNAME}api/electricity?from=${startTimestamp}&to=${endTimestamp}`));
		requestDetails.push({start, end});
	}        
	try {
		const responses = await Promise.all(fetchRequests);
		for (let i = 0; i < intervals; i++) {
			const details = requestDetails[i];
			const response = responses[i];
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const energy = await response.json();
			const joules = energy * 3600;
			const averagePower = joules / (details.end - details.start) * 1000;
			graphData.push({ time: details.start, power: averagePower, energy: energy });
		}
	} catch (error) {
		console.error('Error fetching interval data:', error);
	}

	renderGraph(graphData, now);
}

function formatApiTimestamp(date) {
	const pad = (num) => num.toString().padStart(2, '0');
	return `${date.getFullYear().toString().slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function renderGraph(data, now) {
	const graph = document.getElementById('graph');
	graph.innerHTML = '';

	const interval = 15 * 60 * 1000;
	const bars = data.length;
	const barWidth = graph.clientWidth / bars;
	const maxHeight = graph.clientHeight;

	const maxPower = Math.max(...data.map((entry) => entry.power), 0.1);

	const midnight = new Date();
	midnight.setHours(0, 0, 0, 0);
	
	const tooltip = document.getElementById('tooltip');

	data.forEach((entry, index) => {
		const bar = document.createElement('div');
		bar.classList.add('bar');

		let scaledHeight = (entry.power / maxPower) * maxHeight;
		scaledHeight = Math.max(scaledHeight, 2);
		bar.style.height = `${scaledHeight}px`;
		bar.style.width = `${barWidth}px`;
		bar.style.left = `${index * barWidth}px`;
		
		if (entry.time >= midnight) {
			bar.classList.add('current');
		} else {
			bar.classList.add('faded');
		}
		
		bar.addEventListener('mouseenter', (e) => {
			const startTime = formatTooltipTime(entry.time);
			const endTime = formatTooltipTime(new Date(entry.time.getTime() + interval));
			tooltip.innerHTML = `\
			<strong>${startTime} - ${endTime}</strong><br>
			${entry.power} W (${entry.energy} Wh)`;
		tooltip.style.opacity = 1;
		const tooltipWidth = tooltip.offsetWidth;
		const tooltipHeight = tooltip.offsetHeight;
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;
		let left = e.pageX + 10;
		let top = e.pageY - 30;
		if (left + tooltipWidth > windowWidth) {
		  left = windowWidth - tooltipWidth - 10;
		}
		if (top + tooltipHeight > windowHeight) {
		  top = windowHeight - tooltipHeight - 10;
		}
		if (left < 0) {
		  left = 10;
		}
		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;
	});

		bar.addEventListener('mouseleave', () => {
			tooltip.style.opacity = 0;
		});

		graph.appendChild(bar);
	});
}

function formatTooltipTime(date) {
	const pad = (num) => num.toString().padStart(2, '0');
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

fetchPower();
setInterval(fetchPower, 1000);
fetchGraphData();
