// Korean Holiday & Solar Term Service
// Ensure formatDate is available even if script.js is not loaded yet
if (!window.formatDate) {
    window.formatDate = function(date) {
        if (!date) return '';
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };
}

window.KoreanHolidayService = {
  getAutoEvents: function(year, month) {
      const events = [];
      
      // Check for Solar/Lunar in various namespaces (common in browser)
      const SolarNamespace = (typeof Solar !== 'undefined') ? Solar : (typeof lunar !== 'undefined' ? lunar.Solar : null);
      if (!SolarNamespace) {
          // console.warn("lunar-javascript library not found or Solar not defined.");
          return events;
      }

      const solarTermsMap = {
          '立春': '입춘', '雨水': '우수', '驚蟄': '경칩', '春分': '춘분',
          '淸明': '청명', '穀雨': '곡우', '立夏': '입하', '小滿': '소만',
          '芒種': '망종', '夏至': '하지', '小暑': '소서', '大暑': '대서',
          '立秋': '입추', '處暑': '처서', '白露': '백로', '秋分': '추분',
          '寒露': '한로', '霜降': '상강', '立冬': '입동', '小雪': '소설',
          '大雪': '대설', '冬至': '동지', '小寒': '소한', '大寒': '대한',
          '입춘': '입춘', '우수': '우수', '경칩': '경칩', '춘분': '춘분',
          '청명': '청명', '곡우': '곡우', '입하': '입하', '소만': '소만',
          '망종': '망종', '하지': '하지', '소서': '소서', '대서': '대서',
          '입추': '입추', '처서': '처서', '백로': '백로', '추분': '추분',
          '한로': '한로', '상강': '상강', '입동': '입동', '소설': '소설',
          '대설': '대설', '동지': '동지', '소한': '소한', '대한': '대한'
      };

      const fixedHolidays = {
          "01-01": "신정",
          "03-01": "3.1절",
          "05-05": "어린이날",
          "06-06": "현충일",
          "08-15": "광복절",
          "10-03": "개천절",
          "10-09": "한글날",
          "12-25": "성탄절"
      };

      const anniversaries = {
          "04-05": "식목일", "04-19": "4.19혁명", "04-20": "장애인의날",
          "05-01": "근로자의날", "05-08": "어버이날", "05-15": "스승의날",
          "05-18": "5.18민주화기념일", "06-25": "6.25전쟁", "07-17": "제헌절",
          "10-01": "국군의날", "10-25": "독도의날", "11-17": "순국선열의날"
      };

      const lastDay = new Date(year, month + 1, 0).getDate();
      const holidayList = [];

      for (let d = 1; d <= lastDay; d++) {
          const dateObj = new Date(year, month, d);
          let solar;
          try {
              solar = SolarNamespace.fromYmd(year, month + 1, d);
          } catch (e) {
              continue;
          }
          const dateStr = window.formatDate(dateObj);
          const md = `${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          
          let title = "";
          let isHoliday = false;

          // 1. Solar Fixed
          if (fixedHolidays[md]) {
              title = fixedHolidays[md];
              isHoliday = true;
          }

          // 2. Lunar Holidays
          const lunar = solar.getLunar();
          const lm = lunar.getMonth();
          const ld = lunar.getDay();

          if (lm === 1 && ld === 1) { title = "설날"; isHoliday = true; }
          else if (lm === 1 && ld === 2) { title = "설날 연휴"; isHoliday = true; }
          else if (lm === 1 && ld === 3 && [0,6].includes(new Date(year, 0, 1).getDay())) {
             // Simplified
          }
          
          if (!title) {
              const tomorrow = new Date(year, month, d + 1);
              try {
                  const nextLatent = SolarNamespace.fromYmd(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate()).getLunar();
                  if (nextLatent.getMonth() === 1 && nextLatent.getDay() === 1) { title = "설날 연휴"; isHoliday = true; }
              } catch(e){}
          }

          if (lm === 4 && ld === 8) { title = "부처님 오신 날"; isHoliday = true; }
          
          if (lm === 8 && ld === 14) { title = "추석 연휴"; isHoliday = true; }
          else if (lm === 8 && ld === 15) { title = "추석"; isHoliday = true; }
          else if (lm === 8 && ld === 16) { title = "추석 연휴"; isHoliday = true; }

          if (title) {
              events.push({ id: `auto-h-${dateStr}`, title: title, start: dateStr, eventType: 'life', isHoliday: isHoliday, isAuto: true });
              if (isHoliday) holidayList.push({ day: d, title: title, dow: dateObj.getDay() });
          }

          // 3. Anniversaries (Non-holiday)
          if (anniversaries[md] && !title) {
              events.push({ id: `auto-a-${dateStr}`, title: anniversaries[md], start: dateStr, eventType: 'life', isHoliday: false, isAuto: true });
          }

          // 4. Solar Terms
          try {
              const term = lunar.getJieQi() || lunar.getTerm() || "";
              if (term && solarTermsMap[term]) {
                  events.push({ id: `auto-t-${dateStr}`, title: solarTermsMap[term], start: dateStr, eventType: 'life', isHoliday: false, isAuto: true });
              }
          } catch(e){}
      }

      // 5. Substitute Holiday Logic
      holidayList.forEach(h => {
          const needsSub = ["3.1절", "어린이날", "광복절", "개천절", "한글날", "부처님 오신 날", "성탄절"].includes(h.title);
          if (needsSub && (h.dow === 0 || h.dow === 6)) { // Sun or Sat
              let dayOffset = h.dow === 0 ? 1 : 2;
              let subD = h.day + dayOffset;
              if (subD <= lastDay) {
                  const subDateStr = window.formatDate(new Date(year, month, subD));
                  events.push({ id: `auto-sub-${subDateStr}`, title: `대체공휴일(${h.title})`, start: subDateStr, eventType: 'life', isHoliday: true, isAuto: true });
              }
          }
      });

      return events;
  }
};
