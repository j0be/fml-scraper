javascript: (function () {
  window.fsettings = {
    staleThreshold: 5, /* Number of days before a post is considered too old to the scraper */
    autoProjection: 50000, /* If we don't have a projection, how many $ should we give it per FML bux */
    targets: { /* Adjusted manually tweaks the actual projections, weight is how much bearing to give it when averaging the numbers */
      'fml': { url: 'http://fantasymovieleague.com' },
      'insider': { url: 'http://fantasymovieleague.com/news', adjusted: 0.977, weight: .7 },
      'mojo': { url: 'http://www.boxofficemojo.com/news/', adjusted: 0.957, weight: 1 },
      'pro': { url: 'http://pro.boxoffice.com/category/boxoffice-forecasts/', adjusted: 0.954, weight: 1 },
      'rep': { url: 'http://www.boxofficereport.com/predictions/predictions.html', adjusted: 0.953, weight: .9 },
      'bop': { url: 'http://www.boxofficeprophets.com/', adjusted: 0.942, weight: .8 },
      'derby': { url: 'https://derby.boxofficetheory.com/AllPredictions.aspx', adjusted: 1, weight: .2 },
      'coupe': { url: 'https://fantasymovieleague.com/chatter/searchmessages?boardId=fml-main-chatter&query=coupe', adjusted: 1, weight: .1 },
    },
    weekendAdjustments: { /* This is how much to adjust each day of a movie that is split into separate days (they should add up to 1)*/
      '3': { /* 3 day weekend */
        'FRI': .4184,
        'SAT': .3309,
        'SUN': .2507
      },
      '4': { /* 4 day weekend */
        'FRI': .3110,
        'SAT': .2793,
        'SUN': .2798,
        'MON': .1298
      }
    },
  };
  window.fdata = {
    scraped: {},
    formdata: {},
  };

  window.scraper = {
    handlers: {
      navigate: function (target) {
        if (fsettings.targets[target]) {
          scraper.handlers.rawNavigate(fsettings.targets[target].url);
        } else {
          alert('That isn\'t one of the options');
        }
      },
      rawNavigate: function (link) {
        var separator = !!link.match('fantasymovieleague') || (link.match(/^\//) && domain.match('fantasymovieleague'))
          ? (link.match(/\?/) ? '&' : '?') : '#';
        document.location.href = link + separator + 'data=' + encodeURIComponent(JSON.stringify(fdata.scraped));
      },
      chooseTarget: function (ostr, setTarget) {
        var forceAlert = ostr ? true : false;
        str = (ostr ? ostr : '') + 'Where would you like to go?';
        var optionsstr = '',
          placeholder = 'fml';
        for (var key in fsettings.targets) {
          if (fsettings.targets.hasOwnProperty(key) && fsettings.targets[key].url) {
            host = (fsettings.targets[key].url).replace(/https?:\/\//, '').replace(/\.com.*/, '.com');
            if ((!fdata.scraped[key] && domain !== host) || key === 'fml') {
              optionsstr += '\n\u2022 ' + key + ': ' + host;
              placeholder = key !== 'fml' && placeholder === 'fml' ? key : placeholder;
            }
          }
        }
        if (optionsstr.split('\n').length > 2) {
          scraper.handlers.navigate(prompt(str + optionsstr, placeholder));
        } else {
          if (forceAlert) {
            alert(ostr);
          }
          scraper.handlers.navigate('fml');
        }
      },
      path: {
        'fantasymovieleague.com': function () {
          if (document.location.pathname == '/') {
            fdata.formdata = fmlApp.helpers.parseFMLData(fmlApp.helpers.flattenData(fdata.scraped));
            fmlApp.handlers.setup.dom();
            fmlApp.handlers.recalculate();
          } else if (href.match('/posts') || href.match('/news')) {
            scraper.handlers.path['fantasymovieleague.com/insider']();
          } else if (href.match('/searchmessages') || href.match('/chatter')) {
            scraper.handlers.path['fantasymovieleague.com/coupe']();
          } else {
            scraper.handlers.chooseTarget();
          }
        },
        'fantasymovieleague.com/insider': function () {
          fdata.scraped.insider = {};
          if (href.match('news')) {
            var links = $('.news-item h5 a');
            for (var i = 0; i < links.length; i++) {
              if (links[i].getAttribute('title').match(/Estimates/i)) {
                var date = new Date(links[i].parentNode.parentNode.querySelectorAll('.timestamp')[0].textContent.replace(/.*? . /, '').replace(/ . .*/, ''));
                if (scraper.helpers.isntStale(date)) {
                  scraper.handlers.rawNavigate(links[i].getAttribute('href'));
                  break;
                } else {
                  scraper.handlers.chooseTarget("\u274C FML Insider hasn\'t posted yet.\n\n");
                }
                break;
              }
            }
          } else if (href.match('posts')) {
            var rows = $('.post__content')[0].textContent.match(/.*?\$[\d\.,]+( million| ?k)?/gi);
            for (var i = 0; i < rows.length; i++) {
              var code = fmlApp.helpers.cleanTitle(rows[i].match(/(?<=").+(?=")/)[0]);
              var projected = parseFloat(rows[i].match(/(?<=\$).+/)[0].replace(/[,]/g, '').replace(/ ?million/i, ''));
              projected = Math.round(projected < 300 ? projected * 1000000 : projected);
              fdata.scraped.insider[code] = projected;
            }
            scraper.handlers.chooseTarget("\u2714 Grabbed data from FML Insider!\n\n");
          }
        },
        'fantasymovieleague.com/coupe': function () {
          fdata.scraped.coupe = {};
          if (href.match('/searchmessages')) {
            var link = $('.topic-item__title')[0];
            var date = new Date(link.closest('.topic-item__body').querySelectorAll('.time-date')[0].textContent.replace(/, \d+:.*/, ''));
            if (scraper.helpers.isntStale(date)) {
              scraper.handlers.rawNavigate(link.parentNode.getAttribute('data-href'));
            } else {
              scraper.handlers.chooseTarget("\u274C Coupe hasn\'t posted yet.\n\n");
            }
          } else if (href.match('/chatter')) {
            var rows = $('.topic-item__body')[0].textContent.match(/.*?- \$[\d\.,]+M/gi);
            for (var i = 0; i < rows.length; i++) {
              var code = fmlApp.helpers.cleanTitle(rows[i].match(/.+(?= -)/)[0]);
              var projected = parseFloat(rows[i].match(/(?<=\$).+/)[0].replace(/[,]/g, '').replace(/M/, ''));
              projected = Math.round(projected < 1000 ? projected * 1000000 : projected);
              fdata.scraped.coupe[code] = projected;
            }
            scraper.handlers.chooseTarget("\u2714 Grabbed data from Coupe!\n\n");
          }
        },
        'pro.boxoffice.com': function () {
          fdata.scraped.pro = {};
          if (href.match('category')) {
            var links = document.getElementsByTagName('h3');
            for (var i = 0; i < links.length; i++) {
              if (links[i].getElementsByTagName('a')[0].textContent.match('Weekend')) {
                var date = new Date(links[i].parentNode.querySelectorAll('.date')[0].textContent);
                if (scraper.helpers.isntStale(date, -1)) {
                  scraper.handlers.rawNavigate(links[i].getElementsByTagName('a')[0].getAttribute('href'));
                  break;
                } else {
                  scraper.handlers.chooseTarget("\u274C boxofficepro hasn\'t posted yet.\n\n");
                }
                break;
              }
            }
          } else if (href.match('weekend')) {
            var rows = Array.from($('.post-container tbody tr')).slice(1);
            for (var key in rows) {
              var code = fmlApp.helpers.cleanTitle(rows[key].getElementsByTagName('td')[0].textContent);
              var projected = parseFloat(rows[key].getElementsByTagName('td')[2].textContent.replace(/\D/g, ''));
              fdata.scraped.pro[code] = projected;
            }
            scraper.handlers.chooseTarget("\u2714 Grabbed data from boxofficepro!\n\n");
          }
        },
        'www.boxofficereport.com': function () {
          fdata.scraped.rep = {};
          var date = new Date($('h5')[0].textContent.replace(/Published on /mi, '').replace(/ at(.|\r|\n)*/i, ''));
          if (scraper.helpers.isntStale(date, -1)) {
            var rows = Array.from($('h4>table.inlineTable:nth-child(1) tr')).slice(1);
            for (var key in rows) {
              var code = fmlApp.helpers.cleanTitle(rows[key].getElementsByTagName('td')[1].textContent.replace(/<.*?>/g, '').replace(/\(.*?\)/g, ''));
              var projected = parseFloat(rows[key].getElementsByTagName('td')[2].textContent.replace(/[^\d\.]/g, '')) * 1000000;
              fdata.scraped.rep[code] = projected;
            }
            scraper.handlers.chooseTarget("\u2714 Grabbed data from boxofficereport!\n\n");
          } else {
            scraper.handlers.chooseTarget("\u274C boxofficereport hasn\'t posted yet.\n\n");
          }
        },
        'www.boxofficemojo.com': function () {
          fdata.scraped.mojo = {};
          if (!href.match('id=')) {
            var rows = Array.from($('ul.nav_tabs ~ table table')[0].getElementsByTagName('tr')).slice(1);
            for (var i = 0; i < rows.length; i++) {
              var date = new Date(rows[i].querySelectorAll('td>font>b')[0].textContent);
              if (date.getDay() == 4) {
                if (scraper.helpers.isntStale(date)) {
                  scraper.handlers.rawNavigate(rows[i].getElementsByTagName('a')[0].getAttribute('href'));
                } else {
                  scraper.handlers.chooseTarget("\u274C boxofficemojo hasn\'t posted yet.\n\n");
                }
                break;
              }
            }
          } else if (href.match('id=')) {
            var rows = Array.from($('h1 ~ ul')[$('h1 ~ ul').length - 1].getElementsByTagName('li'));
            for (var i = 0; i < rows.length; i++) {
              var code = fmlApp.helpers.cleanTitle(fmlApp.helpers.cleanTitle(rows[i].textContent.replace(/ - .*/,'')));
              var projected = parseFloat(rows[i].textContent.replace(/.*? - \$/, '').replace(/[^\d\.]/g, '')) * 1000000;
              fdata.scraped.mojo[code] = projected;
            }
            scraper.handlers.chooseTarget("\u2714 Grabbed data from boxofficemojo!\n\n");
          }
        },
        'www.boxofficeprophets.com': function () {
          fdata.scraped.bop = {};
          if (!href.match('column')) {
            var links = $('td>a[href*="column/index.cfm?columnID="] strong');
            for (var i = 0; i < links.length; i++) {
              if (links[i].textContent && links[i].textContent.trim().toLowerCase() === 'weekend forecast') {
                var postedDate = links[i].closest('table').querySelectorAll('strong'),
                  date = postedDate[postedDate.length - 1].textContent.trim().toLowerCase() !== 'weekend forecast' ? new Date(postedDate[postedDate.length - 1].textContent) : (new Date()).setHours(0, 0, 0, 0);
                if (scraper.helpers.isntStale(date)) {
                  scraper.handlers.rawNavigate(links[i].closest('a').getAttribute('href'));
                } else {
                  scraper.handlers.chooseTarget("\u274C boxofficeprophets hasn\'t posted yet.\n\n");
                }
                break;
              }
            }
          } else {
            var tables = $('#EchoTopic table'),
              rows = Array.from(tables[tables.length - 1].querySelectorAll('tr')).slice(2);
            for (var i = 0; i < rows.length; i++) {
              var code = fmlApp.helpers.cleanTitle(rows[i].querySelectorAll('td')[1].textContent);
              var projected = parseFloat(rows[i].querySelectorAll('td')[4].textContent.replace(/[^\d\.]/g, '')) * 1000000;
              fdata.scraped.bop[code] = projected;
            }
            scraper.handlers.chooseTarget("\u2714 Grabbed data from boxofficeprophets!\n\n");
          }
        },
        'derby.boxofficetheory.com': function () {
          fdata.scraped.derby = {};
          var date = new Date($('#MainContent_DerbyWeek_AdditionalTitle')[0].textContent.replace(/.*?-/, ''));
          if (scraper.helpers.isntStale(date, fsettings.staleThreshold)) {
            var rows = $('.rgRow,.rgAltRow');
            for (var i = 0; i < rows.length; i++) {
              var code = fmlApp.helpers.cleanTitle(rows[i].querySelectorAll('td')[0].textContent);
              var projected = parseFloat(rows[i].querySelectorAll('td')[2].textContent.replace(/[^\d\.]/g, '')) * 1000000;
              fdata.scraped.derby[code] = projected;
            }
            scraper.handlers.chooseTarget("\u2714 Grabbed data from boxofficetheory!\n\n");
          } else {
            scraper.handlers.chooseTarget("\u274C boxofficetheory hasn\'t updated yet.\n\n");
          }
        }
      }
    },
    helpers: {
      detectPath: function () {
        if (scraper.handlers.path[domain]) {
          fdata.scraped = !!href.match(/[\#\&\?]data=/) ?
            JSON.parse(decodeURIComponent(href.replace(/.*?[\#\&\?]data=/, ''))) : {};
          try {
            return scraper.handlers.path[domain]();
          } catch (err) {
            alert('Uh oh. The scraper for '+domain+' seems to be broken.');
            return scraper.handlers.chooseTarget();
          }
        } else {
          return scraper.handlers.chooseTarget();
        }
      },
      isntStale: function (date, adjusted) {
        var today = (new Date()).setHours(0, 0, 0, 0);
        if (typeof adjusted != 'undefined') {
          date.setDate(date.getDate() + adjusted);
        }
        return today - date < fsettings.staleThreshold * 24 * 60 * 60 * 1000;
      },
    }
  };

  window.fmlApp = {
    handlers: {
      setup: {
        dom: function () {
          if (!$('.cineplex__bd .fml-calc').length) {
            fmlApp.handlers.setup.basic();
            fmlApp.handlers.setup.styles();
            fmlApp.handlers.setup.charts();
          }
          fmlApp.handlers.setup.calculator();
        },
        basic: function () {
          var calc = document.createElement('div'); calc.className = 'fml-calc';
          var output = document.createElement('div'); output.className = 'output';
          var form = document.createElement('form'); form.className = 'calc-form';
          form.addEventListener("submit", function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            return false;
          }, true);
          calc.appendChild(output);
          calc.appendChild(form);
          $('.cineplex__bd')[0].appendChild(calc);
        },
        styles: function () {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', 'https://raw.githubusercontent.com/j0be/fml-scraper/master/fml.css?2' + (new Date()).getDate());
          xhr.send(null);
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
              var styles = document.createElement('style');
              styles.innerHTML = xhr.responseText;
              document.head.appendChild(styles);
            }
          }
        },
        charts: function () {
          var script = document.createElement('script');
          script.onload = function () {
            window.google = google;
            window.google.charts.load('current', {
              'packages': ['corechart']
            });
            window.google.charts.setOnLoadCallback(fmlApp.handlers.addCharts);
          };
          script.setAttribute('src', 'https://www.gstatic.com/charts/loader.js');
          document.head.appendChild(script);
        },
        calculator: function () {
          calcform = $('.fml-calc .calc-form')[0];
          calcform.innerHTML = '<a onclick="fmlApp.handlers.massEnter()">Mass Enter Numbers</a>';
          for (var i = 0; i < fdata.formdata.length; i++) {
            if (fdata.formdata[i].bux > 0) {
              labelStr = '<label ' + (!fdata.formdata[i].hasProjection ? 'class="noProjection" title="Autofilled projection data"' : 'class="hasProjection"') + ' for="calc-' + i + '">';
              labelStr += fdata.formdata[i].title + ' ' + fdata.formdata[i].day +
                (!fdata.formdata[i].hasProjection ? '*' : '');
              labelStr += '</label>';

              projectionsStr = '';
              if (fdata.formdata[i].hasProjection) {
                projectionsStr += '<span class="projections"><span class="title">' +
                  fdata.formdata[i].title + ' ' + fdata.formdata[i].day + '</span><ul>';
                for (key in fdata.scraped) {
                  if (fdata.scraped.hasOwnProperty(key)) {
                    for (innerkey in fdata.scraped[key]) {
                      if (innerkey === fdata.formdata[i].code) {
                        projectionsStr += '<li><span>' + key + '</span><span>' + fmlApp.helpers.currency(fdata.scraped[key][innerkey], 'M') + '</span></li>';
                      }
                    }
                  }
                }
                projectionsStr += '</ul></span>';
              }

              calcform.innerHTML += '<div>' + labelStr +
                '<button title="Subtract 10% from value" onclick="fmlApp.handlers.modifyProjected(this,-10)">-</button>' +
                '<input id="calc-' + i + '" name="' + fdata.formdata[i].code + '" value="' + fmlApp.helpers.currency(fdata.formdata[i].projected, 'rawM').toFixed(2) + '" type="tel" />' +
                '<button title="Add 10% to value" onclick="fmlApp.handlers.modifyProjected(this,10)">+</button>' +
                projectionsStr +
                '</div>';
            }
          }
          calcform.innerHTML += '<button onclick="fmlApp.handlers.recalculate()">Recalculate</button>';
          calcform.innerHTML += '<a onclick="fmlApp.handlers.copy()">Copy Projections</a>';
        }
      },
      copy: function () {
        var copyText = document.createElement('textarea'),
          str = "My projections for this weekend:\r\n\r\nMovie|Projected\r\n:--|--:\r\n",
          projected = 0;
        $('.cineplex__bd')[0].appendChild(copyText);
        fmlApp.helpers.reparseForm();
        var top10 = fdata.formdata.sort(function (a, b) {
          aprojected = a.projected - (a.bestValue ? 2000000 : 0);
          bprojected = b.projected - (b.bestValue ? 2000000 : 0);
          return aprojected < bprojected ? 1 :
            (aprojected > bprojected ? -1 : 0);
        });

        for (var key in top10.slice(0, 10)) {
          projected = top10[key].projected - (top10[key].bestValue ? 2000000 : 0);
          if (projected >= 0) {
            str += top10[key].title + '|';
            str += fmlApp.helpers.currency(projected, 'M') + "\r\n";
          }
        }

        copyText.value = str;
        copyText.select();
        document.execCommand("Copy");
        copyText.parentNode.removeChild(copyText);
      },
      recalculate: function () {
        window.variations = [];
        fmlApp.helpers.reparseForm();
        fmlApp.helpers.getVariation([], 1000);

        $('.fml-calc .output')[0].innerHTML = '';

        fmlApp.handlers.placeLineups();
        fmlApp.handlers.addCharts();
        document.getElementsByTagName('html')[0].scrollTop =
          $('.fml-calc')[0].getBoundingClientRect().y +
          document.getElementsByTagName('html')[0].scrollTop - 100;
      },
      addCharts: function () {
        if (typeof window.google === 'undefined') {
          return false;
        }
        var performanceData = [['Movie', '$/bux', { role: 'style' }]],
          performanceChart = document.createElement('p'),
          projectedData = [['Movie', 'min', 'max', 'projected']],
          projectedChart = document.createElement('p'),
          options = { height: 350, chartArea: { 'width': '80%', 'height': '60%' }, title: 'Dollars per FML bux', backgroundColor: 'transparent', titleTextStyle: { color: '#fff' }, hAxis: { textStyle: { color: '#fff' }, titleTextStyle: { color: '#fff' } }, vAxis: { minValue: 0, textStyle: { color: '#fff' }, titleTextStyle: { color: '#fff' } }, legend: { position: 'none' } };

        var performanceOptions = JSON.parse(JSON.stringify(options)),
          projectedOptions = JSON.parse(JSON.stringify(options));

        projectedOptions.title = 'Weekend Projections';
        projectedOptions.seriesType = 'bars';
        projectedOptions.series = { 0: { color: '#4B2F1E' }, 1: { color: '#85593F' }, 2: { type: 'line', lineWidth: 3, color: '#ff0077' } };

        performanceChart.setAttribute('id', 'performancechart');
        projectedChart.setAttribute('id', 'projectedchart');
        $('.fml-calc .output')[0].insertBefore(performanceChart, $('.fml-calc .output')[0].childNodes[1]);
        $('.fml-calc .output')[0].insertBefore(projectedChart, $('.fml-calc .output')[0].childNodes[1]);

        for (var key in fdata.formdata) {
          if (fdata.formdata[key].title && fdata.formdata[key].projected >= 0) {
            var min = 9000000000,
              max = 0;
            for (datakey in fdata.scraped) {
              for (innerkey in fdata.scraped[datakey]) {
                if (fdata.formdata[key].code == innerkey) {
                  min = Math.min(min, fdata.scraped[datakey][innerkey]);
                  max = Math.max(max, fdata.scraped[datakey][innerkey]);
                }
              }
            }
            min = min === 9000000000 || min === max ? 0 : min;
            projectedData.push([fdata.formdata[key].title + ' ' + fdata.formdata[key].day, min, max, fdata.formdata[key].projected]);
            color = fdata.formdata[key].bestValue ? '#ff0077' : (fdata.formdata[key].nearBest ? '#9a1b57' : (fdata.formdata[key].worstValue ? '#4B2F1E' : '#85593F'));
            performanceData.push([fdata.formdata[key].title + ' ' + fdata.formdata[key].day, fdata.formdata[key].dollarperbux, color]);
          }
        }
        var data = window.google.visualization.arrayToDataTable(projectedData);
        var chart = new window.google.visualization.ComboChart(document.getElementById('projectedchart'));
        chart.draw(data, projectedOptions);

        var data = window.google.visualization.arrayToDataTable(performanceData);
        var chart = new window.google.visualization.ColumnChart(document.getElementById('performancechart'));
        chart.draw(data, performanceOptions);
      },
      placeLineups: function () {
        var bestVariations = window.variations.slice().sort(function (a, b) {
          var aproj = a[a.length - 1].projected,
            bproj = b[b.length - 1].projected;
          return aproj > bproj ? -1 : (aproj < bproj ? 1 : 0);
        }).slice(0, 7);
        for (var l = 0; l < bestVariations.length; l++) {
          var lineup = bestVariations[l],
            variation = document.createElement('div');
          for (var i = 0; i < lineup.length; i++) {
            if (lineup[i].title != 'info') {
              variation.innerHTML +=
                '<span class="img' + (lineup[i].bestValue ? ' bestvalue' : '') + (!lineup[i].hasProjection ? ' defaultProjection' : '') + '" data-title="' + lineup[i].title + ' ' + lineup[i].day + '" ' +
                'data-stats="' + fmlApp.helpers.currency(lineup[i].dollarperbux, ',') + '/bux | ' +
                fmlApp.helpers.currency(lineup[i].projected, ',') + '"><img src="' + lineup[i].img + '"/></span>';
            } else {
              variation.innerHTML +=
                '<h2>' + lineup[i].bux + ' bux remaining</h2>' +
                '<span>' + fmlApp.helpers.currency(lineup[i].projected, ',') + '</span>';
            }
          }
          $('.fml-calc .output')[0].appendChild(variation);
        }
      },
      modifyProjected: function (element, value) {
        var input = element.parentElement.getElementsByTagName('input')[0],
          inputVal = parseFloat(input.value * 1000000);
        input.value = fmlApp.helpers.currency(inputVal * ((100 + value) / 100), 'rawM').toFixed(2);
      },
      massEnter: function () {
        var valueStr = prompt('Enter movie values in millions, space delimited', ''),
          values = valueStr.split(/\s+/),
          formInputs = $('.fml-calc .calc-form input');
        for (var i = 0; i < values.length; i++) {
          formInputs[i].value = values[i];
        }
        fmlApp.handlers.recalculate();
      }
    },
    helpers: {
      currency: function (number, format) {
        switch (format) {
          case 'M':
            return '$' + (Math.round(number / 100000) / 10).toFixed(1) + 'M';
          case ',':
            return Number(number).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD'
            }).slice(0, -3);
          case 'rawM':
            return Math.round(number / 10000) / 100;
          default:
            return '$' + Math.round(number);
        }
      },
      cleanTitle: function (titleStr) {
        titleStr = fmlApp.helpers.exceptionClean(titleStr); /* For movie specific cleanups that are bound to happen */
        titleStr = titleStr.replace(/\b(a|an|the|of)\b/gi, ''); /* Remove articles and common words */
        titleStr = titleStr.replace(/\d+$/, '').replace(/:.*/, ''); /* Try to make sequels consistent */
        titleStr = titleStr.trim().replace(/\s+/g, ' ').split(' ').slice(0, 2).join(''); /* Take the first two words */
        titleStr = titleStr.replace(/\W/g, '').toLowerCase(); /* Cleanup */
        return titleStr; 
      },
      exceptionClean: function(titleStr) {
        var regexes = [
          /Tyler Perry('s)?/i,
        ];
        for (key in regexes) {
          titleStr = titleStr.replace(regexes[key],'');
        }
        return titleStr;
      },
      parseFMLData: function (projectedData) {
        var movies = $('ul.cineplex__bd-movies .cineplex__bd-movie-item .outer-wrap'),
          titles = $('ul.cineplex__bd-movies .cineplex__bd-movie-item .title'),
          imgs = $('ul.cineplex__bd-movies .cineplex__bd-movie-item .proxy-img'),
          bux = $('ul.cineplex__bd-movies .cineplex__bd-movie-item .cost-wrap');
        var fmlData = [];
        var numdays = eval($(".cineplex__bd-week_details .cineplex-details-name-value.first strong")[0].innerHTML.replace(/[a-z]/gi, '')) * -1 + 1;

        for (var i = 0; i < movies.length; i++) {
          var title = titles[i].innerHTML.trim(),
            img = imgs[i].getAttribute('data-img-src');
          var day = title.match(/ONLY$/) ?
            title.substring(0, 3) :
            '';
          var cost = parseFloat(bux[i].childNodes[bux[i].childNodes.length - 1].nodeValue);;
          if (day) {
            title = title.replace(/^\w{3} - /, '').replace(/ - \w{3} ONLY$/, '');
          }
          var code = fmlApp.helpers.cleanTitle(title);

          var projected = projectedData[code],
            hasProjection = !!projected;
          if (!hasProjection) {
            projected = cost * fsettings.autoProjection;
            movies[i].setAttribute('style', 'border: 1px solid #f00');
          }

          if (day) {
            projected = Math.round(projected * fsettings.weekendAdjustments[numdays][day]);
          }

          fmlData.push({
            'code': code + day.toLowerCase(),
            'img': img,
            'title': title,
            'day': day,
            'projected': projected,
            'hasProjection': hasProjection,
            'bux': cost
          });
        }

        fmlData.push({
          'code': 'empty',
          'img': 'https://i.imgur.com/dExP98u.png',
          'title': 'Empty',
          'projected': -2000000,
          'day': '',
          'bux': 0
        });

        return fmlData;
      },
      flattenData: function (projectedData) {
        var tempArr = {},
          returnArr = {};
        for (var source in projectedData) {
          for (var movie in projectedData[source]) {
            tempArr[movie] = tempArr[movie] ? tempArr[movie] : {
              sum: 0,
              count: 0
            };
            tempArr[movie].sum += projectedData[source][movie] * fsettings.targets[source].adjusted * fsettings.targets[source].weight;
            tempArr[movie].count += fsettings.targets[source].weight;
          }
        }
        for (var movie in tempArr) {
          returnArr[movie] = Math.round(tempArr[movie].sum / tempArr[movie].count);
        }
        return returnArr;
      },
      reparseForm: function () {
        var myform = $('.fml-calc .calc-form')[0],
          formVars = Array.from(new FormData(myform), e => e.map(encodeURIComponent)),
          bestValue = 0,
          worstValue = Number.MAX_SAFE_INTEGER;
        for (var movie in fdata.formdata) {
          for (var i = 0; i < formVars.length; i++) {
            if (fdata.formdata[movie].code == formVars[i][0]) {
              fdata.formdata[movie].projected = Math.max(parseFloat(formVars[i][1]) * 1000000, 1);
              bestValue = Math.max((fdata.formdata[movie].projected / fdata.formdata[movie].bux), bestValue);
              worstValue = Math.min((fdata.formdata[movie].projected / fdata.formdata[movie].bux), worstValue);
            }
          }
        }
        for (var movie in fdata.formdata) {
          fdata.formdata[movie].dollarperbux = (fdata.formdata[movie].projected / fdata.formdata[movie].bux);
          fdata.formdata[movie].bestValue = fdata.formdata[movie].dollarperbux >= bestValue;
          fdata.formdata[movie].nearBest = fdata.formdata[movie].dollarperbux >= bestValue * .92;
          fdata.formdata[movie].worstValue = fdata.formdata[movie].dollarperbux <= worstValue;
        }
      },
      getVariation: function (passedLineup, bux) {
        if (passedLineup.length < 8) {
          for (var m = 0; m < fdata.formdata.length; m++) {
            var lineup = passedLineup.slice();
            var movie = fdata.formdata[m],
              prevBux = lineup.length ? lineup[lineup.length - 1].bux : 1000,
              prevProjection = lineup.length ? lineup[lineup.length - 1].projected : 0,
              tooExpensive = bux - movie.bux < 0,
              buxCheaper = movie.bux <= prevBux,
              projectedCheaper = movie.projected < prevProjection;

            if (!tooExpensive && buxCheaper && (movie.bux != prevBux || !projectedCheaper) && lineup.length < 8) {
              lineup.push(movie);
              fmlApp.helpers.getVariation(lineup, bux - movie.bux);
            }
          }
        } else {
          var lineup = passedLineup.slice();
          lineup.push(fmlApp.helpers.getLineupInfo(passedLineup));
          window.variations.push(lineup);
        }
      },
      getLineupInfo: function (vlineup) {
        var projected = 0,
          bux = 1000;
        for (var i = 0; i < vlineup.length; i++) {
          projected += vlineup[i].projected;
          projected += vlineup[i].bestValue ? 2000000 : 0;
          bux -= vlineup[i].bux;
        }
        return {
          'title': 'info',
          'projected': projected,
          'bux': bux,
        };
      }
    }
  };

  $ = function (str) { return document.querySelectorAll(str); };
  window.href = document.location.href;
  window.domain = document.location.hostname;
  scraper.helpers.detectPath();
})();
