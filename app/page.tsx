"use client";
import { useEffect, useState } from "react";
import {
  startOfYear,
  endOfYear,
  format,
  startOfWeek,
  addWeeks,
  addDays,
} from "date-fns";
import Papa from "papaparse";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const CommitGraph = () => {
  const [checkins, setCheckins] = useState({});
  const [weeks, setWeeks] = useState([]);
  const [months, setMonths] = useState([]);
  const [hourlyDistribution, setHourlyDistribution] = useState(
    Array(24).fill(0)
  );
  const [stats, setStats] = useState({
    totalCheckins: 0,
    longestStreak: 0,
    currentStreak: 0,
    averagePerWeek: 0,
    totalDaysVisited: 0,
    peakHour: 0,
    peakHourCount: 0,
  });

  const calculateStats = (data) => {
    const dates = Object.keys(data).sort();

    const totalCheckins = Object.values(data).reduce(
      (acc, value) => acc + value,
      0
    );

    let longestStreak = 0;
    let currentStreak = 0;
    let streak = 0;

    const totalDaysVisited = dates.length;

    dates.forEach((date, index) => {
      const currentDate = new Date(date);
      const previousDate = index > 0 ? new Date(dates[index - 1]) : null;

      if (previousDate) {
        const diffDays = Math.round(
          (currentDate - previousDate) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) {
          streak++;
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }

      longestStreak = Math.max(longestStreak, streak);
    });

    for (let i = dates.length - 1; i >= 0; i--) {
      const currentDate = new Date(dates[i]);
      const previousDate = i > 0 ? new Date(dates[i - 1]) : null;

      if (previousDate) {
        const diffDays = Math.round(
          (currentDate - previousDate) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      } else {
        currentStreak = 1;
      }
    }

    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const totalWeeks = Math.max(
      1,
      Math.ceil(
        (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
      )
    );
    const averagePerWeek = (totalDaysVisited / 52).toFixed(1);

    setStats({
      totalCheckins,
      longestStreak,
      currentStreak,
      averagePerWeek: dates.length > 0 ? averagePerWeek : "0.0",
      totalDaysVisited,
      peakHour: data.peakHour || 0,
      peakHourCount: data.peakHourCount || 0,
    });
  };

  const calculateHourlyDistribution = (data) => {
    const hourCounts = Array(24).fill(0);

    data.forEach((row) => {
      if (row && row.timestamp) {
        const date = new Date(row.timestamp);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          hourCounts[hour]++;
        }
      }
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    setHourlyDistribution(hourCounts);
    return { peakHour, peakHourCount: hourCounts[peakHour] };
  };

  useEffect(() => {
    Papa.parse("/movati2024.csv", {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors && result.errors.length > 0) {
          console.error(
            "CSV parsing errors:",
            JSON.stringify(result.errors, null, 2)
          );
        }

        // Log the total number of entries
        console.log("Total CSV entries:", result.data.length);

        const data = result.data.reduce((acc, row) => {
          if (
            !row ||
            typeof row !== "object" ||
            !row.timestamp ||
            typeof row.timestamp !== "string"
          ) {
            console.warn("Invalid row structure:", row);
            return acc;
          }

          try {
            const date = new Date(row.timestamp);
            if (isNaN(date.getTime())) {
              console.warn("Invalid timestamp:", row.timestamp);
              return acc;
            }

            const formattedDate = format(date, "yyyy-MM-dd");
            // Count the number of check-ins per day instead of just setting to 1
            acc[formattedDate] = (acc[formattedDate] || 0) + 1;
            return acc;
          } catch (error) {
            console.error("Error processing row:", JSON.stringify(row), error);
            return acc;
          }
        }, {});

        if (Object.keys(data).length === 0) {
          console.warn("No valid data was parsed from the CSV file");
        } else {
          const { peakHour, peakHourCount } = calculateHourlyDistribution(
            result.data
          );
          setCheckins(data);
          calculateStats({ ...data, peakHour, peakHourCount });
          console.log("Successfully parsed data:", data);
        }
      },
      error: (error) => {
        console.error("Error loading CSV:", error.message || error);
      },
    });
  }, []);

  useEffect(() => {
    const today = new Date(2024, 11, 31);
    const yearStart = startOfYear(today);
    const yearEnd = endOfYear(today);
    const start = startOfWeek(yearStart, { weekStartsOn: 0 });

    const weeksArray = [];
    let currentWeekStart = start;

    while (currentWeekStart <= yearEnd) {
      weeksArray.push(currentWeekStart);
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }

    const groupedWeeks = weeksArray.map((weekStart) => {
      return Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        return {
          date: day,
          count: checkins[format(day, "yyyy-MM-dd")] || 0,
          isCurrentYear: day.getFullYear() === today.getFullYear(),
        };
      });
    });

    let prevMonth = null;
    const monthLabels = weeksArray.map((weekStart) => {
      const currentDate = weekStart;
      const weekHasCurrentYearDays = Array.from({ length: 7 }, (_, i) =>
        addDays(weekStart, i)
      ).some((day) => day.getFullYear() === today.getFullYear());

      const month = format(currentDate, "MMM");
      const shouldShowMonth =
        weekHasCurrentYearDays &&
        (!prevMonth || month !== prevMonth) &&
        currentDate.getFullYear() === today.getFullYear();

      prevMonth = weekHasCurrentYearDays ? month : prevMonth;
      return {
        text: shouldShowMonth ? month : "",
        width: 1,
      };
    });

    const consolidatedMonths = monthLabels.reduce((acc, curr, index) => {
      if (curr.text) {
        acc.push({ ...curr, startIndex: index });
      } else if (acc.length > 0) {
        acc[acc.length - 1].width++;
      }
      return acc;
    }, []);

    setWeeks(groupedWeeks);
    setMonths(consolidatedMonths);
  }, [checkins]);

  const getColor = (day) => {
    if (!day.isCurrentYear) return "bg-transparent";
    return day.count === 0 ? "bg-gray-100" : "bg-green-500";
  };

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const renderHourlyDistribution = () => {
    const options = {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: "Check-ins by Hour",
          color: "black",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: "black",
          },
        },
        x: {
          ticks: {
            color: "black",
            callback: (value) => `${value}:00`,
          },
        },
      },
      maintainAspectRatio: false,
    };

    const data = {
      labels: Array.from({ length: 24 }, (_, i) => i),
      datasets: [
        {
          data: hourlyDistribution,
          backgroundColor: "rgb(34, 197, 94)",
          hoverBackgroundColor: "rgb(22, 163, 74)",
          borderRadius: 4,
        },
      ],
    };

    return (
      <div className="mt-8 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <Bar options={options} data={data} height={150} />
      </div>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Month Labels */}
      <div className="flex">
        {/* Spacer for day labels column */}
        <div className="w-8"></div>
        <div className="flex">
          {months.map((month, i) => (
            <div
              key={i}
              className="text-xs text-white"
              style={{
                width: `${month.width * 20}px`, // 20px = 16px (w-4) + 4px (gap-1)
                marginLeft: i === 0 ? `${month.startIndex * 20}px` : 0,
              }}
            >
              {month.text}
            </div>
          ))}
        </div>
      </div>

      {/* Commit Grid with Day Labels */}
      <div className="flex">
        {/* Day Labels Column */}
        <div className="flex flex-col gap-1 pr-2 ">
          {dayLabels.map((day, index) => (
            <div
              key={index}
              className="text-xs text-white h-4 flex items-center"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Commit Grid */}
        <div className="flex gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`h-4 w-4 ${getColor(day)} rounded-sm`}
                  title={
                    day.isCurrentYear
                      ? `${format(day.date, "MMM d, yyyy")}: ${
                          day.count
                        } check-ins`
                      : ""
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Statistics Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm text-black">Total Check-ins</h3>
          <p className="text-2xl font-bold text-black">{stats.totalCheckins}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm text-black">Days Visited</h3>
          <p className="text-2xl font-bold text-black">
            {stats.totalDaysVisited}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm text-black">Longest Streak</h3>
          <p className="text-2xl font-bold text-black">
            {stats.longestStreak} days
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm text-black">Average per Week</h3>
          <p className="text-2xl font-bold text-black">
            {stats.averagePerWeek}
          </p>
        </div>
      </div>

      {/* Hourly Distribution Chart */}
      {renderHourlyDistribution()}
    </div>
  );
};

export default CommitGraph;
