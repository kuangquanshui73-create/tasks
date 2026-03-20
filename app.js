// 小可爱任务管理系统
class CuteTaskManager {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('cuteTasks')) || [];
        this.userData = JSON.parse(localStorage.getItem('cuteUserData')) || {
            totalCompleted: 0,
            streakDays: 0,
            totalStars: 0,
            lastActiveDate: null,
            rewards: [],
            totalFocusTime: 0
        };
        this.currentEditingTask = null;
        this.focusingTask = null;
        this.focusTimer = null;
        this.focusRemainingTime = 25 * 60;
        this.focusTotalTime = 25 * 60;
        this.isPaused = false;

        // 连击系统
        this.recentCompletions = []; // 记录最近完成任务的时间戳
        this.comboCount = 0;

        this.init();
    }

    init() {
        this.updateGreeting();
        this.updateCurrentDate();
        this.bindEvents();
        this.initDateTimeDefaults();
        this.renderTasks();
        this.updateStats();
        this.checkStreak();
        this.startReminderCheck();
        this.initCloudSync();
        this.updateDailyProgress();
        this.updateRecommendSection();
        this.initMobileNav(); // 初始化移动端导航

        // 每分钟更新时间
        setInterval(() => this.updateCurrentDate(), 60000);
        // 每秒更新倒计时
        setInterval(() => this.updateCountdown(), 1000);
        // 每分钟刷新进度和推荐
        setInterval(() => {
            this.updateDailyProgress();
            this.updateRecommendSection();
        }, 60000);
    }

    // 更新问候语
    updateGreeting() {
        const hour = new Date().getHours();
        let greeting = '';
        
        if (hour >= 5 && hour < 9) {
            greeting = '🌅 早安呀,新的一天开始啦!';
        } else if (hour >= 9 && hour < 12) {
            greeting = '☀️ 上午好,元气满满!';
        } else if (hour >= 12 && hour < 14) {
            greeting = '🍽️ 中午好,记得好好吃饭哦!';
        } else if (hour >= 14 && hour < 18) {
            greeting = '💪 下午好,继续加油!';
        } else if (hour >= 18 && hour < 22) {
            greeting = '🌙 晚上好,辛苦了一天啦!';
        } else {
            greeting = '😴 夜深了,早点休息哦!';
        }
        
        document.getElementById('greeting').textContent = greeting + ' 💖';
    }

    // 更新当前日期 + 今晚8点倒计时
    updateCurrentDate() {
        const now = new Date();
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        const dateStr = now.toLocaleDateString('zh-CN', options);
        document.getElementById('currentDate').textContent = dateStr;
        this.updateCountdown();
    }

    // 计算距今晚8点还有多久
    updateCountdown() {
        const now = new Date();
        const deadline = new Date();
        deadline.setHours(20, 0, 0, 0); // 今天20:00:00

        // 如果已经过了8点,则倒计时到明天8点
        if (now >= deadline) {
            deadline.setDate(deadline.getDate() + 1);
        }

        const diff = deadline - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const countdownEl = document.getElementById('countdownTimer');
        if (!countdownEl) return;

        const isToday = now < new Date().setHours(20, 0, 0, 0);
        const label = isToday ? '今晚8点截止' : '明晚8点截止';

        let urgencyClass = 'countdown-normal';
        let emoji = '⏰';
        if (hours < 1) {
            urgencyClass = 'countdown-urgent';
            emoji = '🔥';
        } else if (hours < 3) {
            urgencyClass = 'countdown-warning';
            emoji = '⚠️';
        }

        countdownEl.className = `countdown-timer ${urgencyClass}`;
        countdownEl.innerHTML = `
            <span class="countdown-emoji">${emoji}</span>
            <span class="countdown-label">${label}还剩</span>
            <span class="countdown-time">${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}</span>
        `;
    }

    // 初始化日期时间默认值
    initDateTimeDefaults() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().slice(0, 5);
        
        // 设置默认时间为今天+1小时
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const dueTime = oneHourLater.toTimeString().slice(0, 5);
        
        document.getElementById('taskDueDate').value = today;
        document.getElementById('taskDueTime').value = dueTime;
    }

    // 绑定事件
    bindEvents() {
        // 添加任务
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // 优先级选择
        document.querySelectorAll('.priority-label').forEach(label => {
            label.addEventListener('click', (e) => {
                document.querySelectorAll('.priority-label').forEach(l => l.classList.remove('active'));
                label.classList.add('active');
                label.querySelector('input').checked = true;
            });
        });

        // 筛选标签
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderTasks(tab.dataset.filter);
            });
        });

        // 完成任务弹窗
        document.getElementById('confirmComplete').addEventListener('click', () => this.completeTaskWithReview());
        document.getElementById('skipReview').addEventListener('click', () => this.completeTaskWithoutReview());

        // 复核建议
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.suggestion-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('customReward').value = btn.dataset.reward;
            });
        });

        // 编辑任务
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(btn.closest('.modal').id));
        });

        // 奖励兑换
        document.querySelectorAll('.redeem-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.redeemReward(e.target.closest('.reward-item')));
        });

        // 数据导出
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());

        const importFile = document.getElementById('importFile');
        if (importFile) importFile.addEventListener('change', (e) => this.importData(e));

        // 专注模式
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.focusTotalTime = parseInt(btn.dataset.time) * 60;
                this.focusRemainingTime = this.focusTotalTime;
                this.updateTimerDisplay();
            });
        });

        document.getElementById('startFocus').addEventListener('click', () => this.startFocus());
        document.getElementById('pauseFocus').addEventListener('click', () => this.togglePauseFocus());
        document.getElementById('stopFocus').addEventListener('click', () => this.stopFocus());
        document.getElementById('closeFocusComplete').addEventListener('click', () => this.closeModal('focusCompleteModal'));

        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // 移动端导航栏
        const bottomNav = document.getElementById('bottomNav');
        if (bottomNav) {
            bottomNav.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const page = item.dataset.page;
                    if (page) {
                        this.switchPage(page);
                    }
                });
            });
        }

        // 悬浮添加按钮
        const fab = document.getElementById('fabAdd');
        if (fab) {
            fab.addEventListener('click', () => {
                this.showAddTaskForm();
            });
        }
    }

    // 添加任务
    addTask() {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) return;

        const now = new Date();
        const task = {
            id: Date.now(),
            title: title,
            notes: '',
            priority: document.querySelector('input[name="priority"]:checked').value,
            dueDate: document.getElementById('taskDueDate').value,
            dueTime: document.getElementById('taskDueTime').value,
            reminder: document.getElementById('taskReminder').checked,
            completed: false,
            createdAt: now.toISOString(),
            lastModified: now.toISOString(),
            completedAt: null,
            review: '',
            reward: '',
            focusTime: 0
        };

        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        this.showNotification('📝 任务添加成功!', 'success');

        // 重置表单
        document.getElementById('taskTitle').value = '';
        this.initDateTimeDefaults();
    }

    // 渲染任务列表
    renderTasks(filter = 'all') {
        const taskList = document.getElementById('taskList');
        const emptyState = document.getElementById('emptyState');
        
        let filteredTasks = [...this.tasks];

        if (filter === 'pending') {
            filteredTasks = filteredTasks.filter(t => !t.completed);
        } else if (filter === 'completed') {
            filteredTasks = filteredTasks.filter(t => t.completed);
        }

        // 按优先级和截止时间排序
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31');
        });

        if (filteredTasks.length === 0) {
            taskList.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            taskList.innerHTML = filteredTasks.map(task => this.createTaskHTML(task)).join('');
        }

        // 渲染后更新推荐高亮
        this.updateRecommendSection();
    }

    // 创建任务HTML
    createTaskHTML(task) {
        const priorityEmoji = {
            high: '🔴',
            medium: '🟡',
            low: '🟢'
        };

        const priorityClass = task.priority;
        const completedClass = task.completed ? 'completed' : '';
        const isOverdue = this.isOverdue(task);
        const overdueClass = isOverdue ? 'overdue' : '';
        const urgentSoonClass = !isOverdue && this.isUrgentSoon(task) ? 'urgent-soon' : '';

        const dueDateDisplay = task.dueDate ? 
            this.formatDateTime(task.dueDate, task.dueTime) : 
            '没有截止时间';

        // 预估时间
        const estMin = this.estimateTaskTime(task.title);
        const is2Min = estMin <= 2;
        const estimateBadge = is2Min
            ? `<span class="task-2min-badge">⚡ 2分钟任务</span>`
            : `<span class="task-estimate-badge">⏱️ 约${estMin}分钟</span>`;

        return `
            <div class="task-item ${priorityClass} ${completedClass} ${overdueClass} ${urgentSoonClass}" data-id="${task.id}">
                <div class="task-main">
                    ${!task.completed ? `
                    <button class="focus-btn" onclick="taskManager.showFocusModal(${task.id})">🎯</button>
                    ` : ''}
                    <button class="complete-btn" onclick="taskManager.showCompleteModal(${task.id})">
                        ${task.completed ? '✨' : '⭕'}
                    </button>
                    
                    <div class="task-content">
                        <div class="task-header">
                            <h3 class="task-title">${this.escapeHTML(task.title)}</h3>
                            <span class="task-priority">${priorityEmoji[task.priority]}</span>
                        </div>
                        
                        ${task.notes ? `<p class="task-notes">${this.escapeHTML(task.notes)}</p>` : ''}
                        
                        <div class="task-meta">
                            ${!task.completed ? estimateBadge : ''}
                            <span class="task-due">📅 ${dueDateDisplay}</span>
                            ${task.reminder ? '<span class="task-reminder">🔔</span>' : ''}
                            ${task.focusTime > 0 ? `<span class="task-focus">🎯 ${task.focusTime}分钟</span>` : ''}
                            ${isOverdue ? '<span class="task-overdue">⚠️ 逾期</span>' : ''}
                            ${urgentSoonClass ? '<span style="color:#FF8C00;font-weight:bold;font-size:0.82em;">🔔 即将截止</span>' : ''}
                        </div>
                        
                        ${task.completed && task.reward ? `
                            <div class="task-reward">
                                <span class="reward-icon">🎁</span>
                                <span>${this.escapeHTML(task.reward)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <button class="edit-btn" onclick="taskManager.editTask(${task.id})">✏️</button>
                    <button class="delete-btn" onclick="taskManager.deleteTask(${task.id})">🗑️</button>
                </div>
            </div>
        `;
    }

    // 显示专注弹窗
    showFocusModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.focusingTask = taskId;
        document.getElementById('focusTaskTitle').textContent = task.title;
        document.getElementById('focusTaskNotes').textContent = task.notes || '';
        
        // 重置计时器
        this.focusTotalTime = 25 * 60;
        this.focusRemainingTime = 25 * 60;
        this.isPaused = false;
        this.updateTimerDisplay();
        
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.preset-btn[data-time="25"]').classList.add('active');
        
        // 更新激励语
        this.updateFocusMotivation();
        
        document.getElementById('focusModal').style.display = 'flex';
    }

    // 更新专注激励语
    updateFocusMotivation() {
        const motivations = [
            '💪 保持专注,你可以的!',
            '🌟 每一分钟都很珍贵!',
            '🎯 全身心投入吧!',
            '✨ 你正在变得更好!',
            '💖 坚持就是胜利!'
        ];
        const randomMotivation = motivations[Math.floor(Math.random() * motivations.length)];
        document.getElementById('focusMotivationText').textContent = randomMotivation;
    }

    // 更新计时器显示
    updateTimerDisplay() {
        const minutes = Math.floor(this.focusRemainingTime / 60);
        const seconds = this.focusRemainingTime % 60;
        
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timerMinutes').textContent = minutes;
        document.getElementById('timerSeconds').textContent = seconds;
        document.getElementById('runningMinutes').textContent = minutes;
        document.getElementById('runningSeconds').textContent = seconds;
        
        // 更新进度条
        const progress = ((this.focusTotalTime - this.focusRemainingTime) / this.focusTotalTime) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('progressText').textContent = `已完成 ${Math.round(progress)}%`;
    }

    // 开始专注
    startFocus() {
        this.closeModal('focusModal');
        
        document.getElementById('focusRunningTask').textContent = this.tasks.find(t => t.id === this.focusingTask).title;
        document.getElementById('focusRunningModal').style.display = 'flex';
        
        this.focusTimer = setInterval(() => {
            if (!this.isPaused) {
                this.focusRemainingTime--;
                this.updateTimerDisplay();
                
                if (this.focusRemainingTime <= 0) {
                    this.completeFocus();
                }
            }
        }, 1000);
    }

    // 切换暂停
    togglePauseFocus() {
        this.isPaused = !this.isPaused;
        document.getElementById('pauseFocus').textContent = this.isPaused ? '▶️ 继续' : '⏸️ 暂停';
    }

    // 停止专注
    stopFocus() {
        clearInterval(this.focusTimer);
        this.closeModal('focusRunningModal');
        
        const timeSpent = Math.floor((this.focusTotalTime - this.focusRemainingTime) / 60);
        if (timeSpent > 0) {
            // 保存专注时间
            const task = this.tasks.find(t => t.id === this.focusingTask);
            if (task) {
                task.focusTime = (task.focusTime || 0) + timeSpent;
                this.saveTasks();
            }
            
            this.showNotification(`🎯 专注了 ${timeSpent} 分钟,加油!`, 'info');
        }
    }

    // 完成专注
    completeFocus() {
        clearInterval(this.focusTimer);
        
        const timeSpent = Math.floor(this.focusTotalTime / 60);
        const task = this.tasks.find(t => t.id === this.focusingTask);
        
        // 计算额外星星
        const extraStars = Math.floor(timeSpent / 15);
        
        // 更新任务数据
        if (task) {
            task.focusTime = (task.focusTime || 0) + timeSpent;
            this.saveTasks();
        }
        
        // 更新用户数据
        this.userData.totalFocusTime += timeSpent;
        this.userData.totalStars += extraStars;
        this.saveUserData();
        
        // 显示完成弹窗
        document.getElementById('focusRunningModal').style.display = 'none';
        document.getElementById('focusTimeSpent').textContent = timeSpent;
        document.getElementById('focusStarsEarned').textContent = extraStars;
        document.getElementById('focusCompleteModal').style.display = 'flex';
        
        // 撒花
        this.triggerConfetti();
        this.updateStats();
    }

    // 显示完成弹窗
    showCompleteModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (task.completed) {
            // 如果已完成,则取消完成
            task.completed = false;
            task.completedAt = null;
            task.lastModified = new Date().toISOString();
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
            this.showNotification('📋 任务已恢复', 'info');
            return;
        }

        this.currentEditingTask = taskId;
        document.getElementById('completedTaskTitle').textContent = task.title;

        // 根据优先级计算星星
        const stars = this.calculateStars(task);
        document.getElementById('earnedStarsCount').textContent = stars;

        // 清空表单
        document.getElementById('taskReview').value = '';
        document.getElementById('customReward').value = '';
        document.querySelectorAll('.suggestion-btn').forEach(b => b.classList.remove('selected'));

        document.getElementById('completeModal').style.display = 'flex';
    }

    // 计算星星数量
    calculateStars(task) {
        const baseStars = { high: 5, medium: 3, low: 1 };
        let stars = baseStars[task.priority];
        
        // 逾期任务扣星星
        if (this.isOverdue(task)) {
            stars = Math.max(1, stars - 2);
        }
        
        // 专注加成
        if (task.focusTime >= 25) {
            stars += 2;
        } else if (task.focusTime >= 15) {
            stars += 1;
        }
        
        return stars;
    }

    // 带复盘完成任务
    completeTaskWithReview() {
        const task = this.tasks.find(t => t.id === this.currentEditingTask);
        if (!task) return;

        const review = document.getElementById('taskReview').value.trim();
        const reward = document.getElementById('customReward').value.trim();

        task.completed = true;
        task.completedAt = new Date().toISOString();
        task.lastModified = new Date().toISOString();
        task.review = review;
        task.reward = reward;

        const stars = this.calculateStars(task);
        this.userData.totalStars += stars;
        this.userData.totalCompleted++;
        this.saveUserData();
        this.saveTasks();

        this.renderTasks();
        this.updateStats();
        this.updateDailyProgress();
        this.updateRecommendSection();
        this.closeModal('completeModal');
        this.showNotification(`🎉 完成任务!获得 ${stars} 颗星星!`, 'success');
        this.triggerConfetti();
        this.checkComboSystem();
    }

    // 不带复盘完成任务
    completeTaskWithoutReview() {
        const task = this.tasks.find(t => t.id === this.currentEditingTask);
        if (!task) return;

        task.completed = true;
        task.completedAt = new Date().toISOString();
        task.lastModified = new Date().toISOString();

        const stars = this.calculateStars(task);
        this.userData.totalStars += stars;
        this.userData.totalCompleted++;
        this.saveUserData();
        this.saveTasks();

        this.renderTasks();
        this.updateStats();
        this.updateDailyProgress();
        this.updateRecommendSection();
        this.closeModal('completeModal');
        this.showNotification(`🎉 完成任务!获得 ${stars} 颗星星!`, 'success');
        this.triggerConfetti();
        this.checkComboSystem();
    }

    // 编辑任务
    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        document.getElementById('editTaskId').value = taskId;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskNotes').value = task.notes || '';
        
        const priorityInput = document.querySelector(`input[name="editPriority"][value="${task.priority}"]`);
        if (priorityInput) priorityInput.checked = true;
        
        document.getElementById('editTaskDueDate').value = task.dueDate || '';
        document.getElementById('editTaskDueTime').value = task.dueTime || '';

        document.getElementById('editModal').style.display = 'flex';
    }

    // 保存编辑
    saveEdit() {
        const taskId = parseInt(document.getElementById('editTaskId').value);
        const task = this.tasks.find(t => t.id === taskId);

        if (task) {
            task.title = document.getElementById('editTaskTitle').value.trim();
            task.notes = document.getElementById('editTaskNotes').value.trim();
            task.priority = document.querySelector('input[name="editPriority"]:checked').value;
            task.dueDate = document.getElementById('editTaskDueDate').value;
            task.dueTime = document.getElementById('editTaskDueTime').value;
            task.lastModified = new Date().toISOString(); // 更新修改时间

            this.saveTasks();
            this.renderTasks();
            this.closeModal('editModal');
            this.showNotification('✏️ 任务已更新!', 'success');
        }
    }

    // 删除任务
    deleteTask(taskId) {
        if (confirm('确定要删除这个任务吗? 💔')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
            this.showNotification('🗑️ 任务已删除', 'info');
        }
    }

    // 导出数据
    exportData() {
        const data = {
            tasks: this.tasks,
            userData: this.userData,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `小可爱任务本_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showNotification('📤 数据已导出,可以在其他设备导入使用!', 'success');
    }

    // 导入数据
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.tasks || !data.userData) {
                    throw new Error('数据格式不正确');
                }
                
                // 合并数据
                const existingIds = this.tasks.map(t => t.id);
                const newTasks = data.tasks.filter(t => !existingIds.includes(t.id));
                
                if (newTasks.length > 0) {
                    this.tasks = [...this.tasks, ...newTasks];
                    this.userData.totalStars += data.userData.totalStars || 0;
                    this.userData.totalFocusTime += data.userData.totalFocusTime || 0;
                    
                    this.saveTasks();
                    this.saveUserData();
                    this.renderTasks();
                    this.updateStats();
                    
                    this.showNotification(`📥 成功导入 ${newTasks.length} 个任务!`, 'success');
                } else {
                    this.showNotification('📥 这些任务已经存在啦!', 'info');
                }
            } catch (error) {
                this.showNotification('❌ 导入失败,请检查文件格式!', 'error');
            }
            
            // 清空文件输入
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }

    // 更新统计数据
    updateStats() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // 总体成就
        document.getElementById('totalCompleted').textContent = this.userData.totalCompleted;
        document.getElementById('streakDays').textContent = this.userData.streakDays;
        document.getElementById('totalStars').textContent = this.userData.totalStars;

        // 今日统计
        const todayTasks = this.tasks.filter(t => t.createdAt.startsWith(today));
        const todayCompleted = this.tasks.filter(t => 
            t.completed && t.completedAt && t.completedAt.startsWith(today)
        );
        
        document.getElementById('todayTasks').textContent = todayTasks.length;
        document.getElementById('todayCompleted').textContent = todayCompleted.length;
        document.getElementById('todayRemaining').textContent = 
            todayTasks.filter(t => !t.completed).length;
        document.getElementById('earnedStars').textContent = 
            todayCompleted.reduce((sum, t) => sum + this.calculateStars(t), 0);

        // 今日进度条
        const totalCount = todayTasks.length;
        const completedCount = todayCompleted.length;
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        const fillEl = document.getElementById('dailyProgressFill');
        const statsEl = document.getElementById('progressStats');
        const percentEl = document.getElementById('progressPercent');
        const hoursLeftEl = document.getElementById('hoursLeft');
        
        if (fillEl) fillEl.style.width = percent + '%';
        if (statsEl) statsEl.innerHTML = `今天完成了 <strong>${completedCount}</strong> / <strong>${totalCount}</strong> 个任务`;
        if (percentEl) percentEl.textContent = percent + '%';
        
        // 计算今天剩余小时数
        if (hoursLeftEl) {
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            const hoursLeft = Math.max(0, Math.round((endOfDay - now) / (1000 * 60 * 60)));
            hoursLeftEl.innerHTML = `⏳ 今天还有 <strong>${hoursLeft}</strong> 小时`;
        }

        // 更新「现在做这个」推荐区域
        this.updateRecommendSection();

        this.updateRewardButtons();
    }

    // 更新推荐区域
    updateRecommendSection() {
        const pendingTasks = this.tasks.filter(t => !t.completed);
        const recommendSection = document.getElementById('recommendSection');
        if (!recommendSection) return;

        if (pendingTasks.length === 0) {
            recommendSection.style.display = 'none';
            return;
        }

        // 推荐优先级最高、截止时间最近的未完成任务
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const recommended = pendingTasks.sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31');
        })[0];

        const priorityLabels = { high: '🔴 重要', medium: '🟡 普通', low: '🟢 悠闲' };
        const estimatedMins = recommended.priority === 'high' ? 30 : recommended.priority === 'medium' ? 20 : 10;

        const titleEl = document.getElementById('recommendTaskTitle');
        const timeBadge = document.getElementById('recommendTimeBadge');
        const priorityBadge = document.getElementById('recommendPriorityBadge');
        const startBtn = document.getElementById('recommendStartBtn');

        if (titleEl) titleEl.textContent = recommended.title;
        if (timeBadge) timeBadge.textContent = `⏱️ 预计 ${estimatedMins} 分钟`;
        if (priorityBadge) priorityBadge.textContent = priorityLabels[recommended.priority];
        if (startBtn) {
            startBtn.onclick = () => this.showFocusModal(recommended.id);
        }

        recommendSection.style.display = 'block';
    }

    // 检查连续打卡
    checkStreak() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (this.userData.lastActiveDate === today) {
            return;
        }

        const todayCompleted = this.tasks.some(t => 
            t.completed && t.completedAt && t.completedAt.startsWith(today)
        );

        if (todayCompleted) {
            if (this.userData.lastActiveDate === yesterday) {
                this.userData.streakDays++;
            } else if (this.userData.lastActiveDate !== today) {
                this.userData.streakDays = 1;
            }
            this.userData.lastActiveDate = today;
            this.saveUserData();
        }
    }

    // 兑换奖励
    redeemReward(rewardItem) {
        const cost = parseInt(rewardItem.dataset.cost);
        const rewardName = rewardItem.querySelector('.reward-name').textContent;

        if (this.userData.totalStars < cost) {
            this.showNotification(`星星不够哦!需要 ${cost} 颗星星`, 'error');
            return;
        }

        if (confirm(`确定要兑换 "${rewardName}" 吗?需要 ${cost} 颗星星 🎁`)) {
            this.userData.totalStars -= cost;
            this.userData.rewards.push({
                name: rewardName,
                cost: cost,
                redeemedAt: new Date().toISOString()
            });
            this.saveUserData();
            this.updateStats();
            this.showNotification(`🎉 成功兑换 "${rewardName}"!享受你的奖励吧!`, 'success');
            this.triggerConfetti();
        }
    }

    // 更新奖励按钮状态
    updateRewardButtons() {
        document.querySelectorAll('.reward-item').forEach(item => {
            const cost = parseInt(item.dataset.cost);
            const btn = item.querySelector('.redeem-btn');
            
            if (this.userData.totalStars >= cost) {
                btn.disabled = false;
                btn.textContent = '兑换';
            } else {
                btn.disabled = true;
                btn.textContent = `缺 ${cost - this.userData.totalStars} ⭐`;
            }
        });
    }

    // 开始提醒检查
    startReminderCheck() {
        setInterval(() => {
            this.checkReminders();
        }, 60000);
    }

    // 检查提醒
    checkReminders() {
        const now = new Date();
        
        this.tasks.forEach(task => {
            if (task.reminder && task.dueDate && !task.completed && !task.reminded) {
                const due = new Date(task.dueDate);
                if (task.dueTime) {
                    const [hours, minutes] = task.dueTime.split(':');
                    due.setHours(hours, minutes, 0, 0);
                }
                
                const timeDiff = due - now;
                if (timeDiff > 0 && timeDiff <= 30 * 60 * 1000) {
                    this.showNotification(`🔔 提醒: "${task.title}" 将在30分钟后到期!`, 'warning');
                    task.reminded = true;
                    this.saveTasks();
                }
            }
        });
    }

    // 判断任务是否逾期
    isOverdue(task) {
        if (task.completed || !task.dueDate) return false;
        const now = new Date();
        const due = new Date(task.dueDate);
        if (task.dueTime) {
            const [hours, minutes] = task.dueTime.split(':');
            due.setHours(hours, minutes, 0, 0);
        }
        return due < now;
    }

    // 判断任务是否临近截止（3小时内）
    isUrgentSoon(task) {
        if (task.completed || !task.dueDate) return false;
        if (this.isOverdue(task)) return false;
        const now = new Date();
        const due = new Date(task.dueDate);
        if (task.dueTime) {
            const [h, m] = task.dueTime.split(':');
            due.setHours(h, m, 0, 0);
        } else {
            due.setHours(23, 59, 59, 999);
        }
        const diff = due - now;
        return diff > 0 && diff <= 3 * 60 * 60 * 1000;
    }

    // 根据关键词估算任务时长（分钟）
    estimateTaskTime(title) {
        const t = title.toLowerCase();
        // 关键词匹配
        if (/会议|开会|meeting|汇报|汇报|评审/.test(t)) return 60;
        if (/报告|方案|计划|ppt|演示|文档|写作|撰写/.test(t)) return 45;
        if (/代码|开发|功能|调试|bug|fix|实现|接口/.test(t)) return 60;
        if (/回复|回答|邮件|消息|通知|沟通|联系/.test(t)) return 10;
        if (/整理|归档|清理|备份/.test(t)) return 20;
        if (/阅读|看|浏览|研究|调研/.test(t)) return 30;
        if (/签字|确认|审批|审核/.test(t)) return 5;
        if (/买|采购|购买|下单/.test(t)) return 10;
        if (/学习|练习|练/.test(t)) return 40;
        if (/测试|test/.test(t)) return 30;
        // 根据字数估算
        if (title.length <= 5) return 5;
        if (title.length <= 10) return 15;
        if (title.length <= 20) return 25;
        return 30;
    }

    // 找出最应该现在做的任务
    getRecommendedTask() {
        const pending = this.tasks.filter(t => !t.completed);
        if (pending.length === 0) return null;

        const now = new Date();

        // 评分函数：分越高越优先
        const score = (task) => {
            let s = 0;
            const priorityScore = { high: 100, medium: 50, low: 10 };
            s += priorityScore[task.priority] || 50;

            if (task.dueDate) {
                const due = new Date(task.dueDate);
                if (task.dueTime) {
                    const [h, m] = task.dueTime.split(':');
                    due.setHours(h, m, 0, 0);
                } else {
                    due.setHours(23, 59, 59, 999);
                }
                const hoursLeft = (due - now) / (1000 * 60 * 60);
                if (hoursLeft < 0) s += 200;        // 已逾期
                else if (hoursLeft < 1) s += 180;
                else if (hoursLeft < 3) s += 120;
                else if (hoursLeft < 24) s += 60;
                else if (hoursLeft < 48) s += 30;
            }

            // 短任务加分（降低启动阻力）
            const est = this.estimateTaskTime(task.title);
            if (est <= 5) s += 40;
            else if (est <= 15) s += 20;
            else if (est <= 30) s += 10;

            return s;
        };

        return pending.sort((a, b) => score(b) - score(a))[0];
    }

    // 更新今日进度条
    updateDailyProgress() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const todayTasks = this.tasks.filter(t => t.createdAt && t.createdAt.startsWith(today));
        const total = todayTasks.length;
        const completed = todayTasks.filter(t => t.completed).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const fill = document.getElementById('dailyProgressFill');
        const percentEl = document.getElementById('progressPercent');
        const statsEl = document.getElementById('progressStats');
        const hoursEl = document.getElementById('hoursLeft');

        if (fill) fill.style.width = percent + '%';
        if (percentEl) percentEl.textContent = percent + '%';
        if (statsEl) statsEl.innerHTML = `今天完成了 <strong>${completed}</strong> / <strong>${total}</strong> 个任务`;

        if (hoursEl) {
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            const hoursLeft = Math.round((endOfDay - now) / (1000 * 60 * 60));
            hoursEl.innerHTML = `⏳ 今天还有 <strong>${hoursLeft}</strong> 小时`;
        }
    }

    // 更新「现在做这个」推荐区域
    updateRecommendSection() {
        const section = document.getElementById('recommendSection');
        const titleEl = document.getElementById('recommendTaskTitle');
        const timeBadge = document.getElementById('recommendTimeBadge');
        const priorityBadge = document.getElementById('recommendPriorityBadge');
        const startBtn = document.getElementById('recommendStartBtn');

        const recommended = this.getRecommendedTask();
        if (!recommended || !section) return;

        section.style.display = 'block';
        titleEl.textContent = recommended.title;

        const est = this.estimateTaskTime(recommended.title);
        timeBadge.textContent = `⏱️ 预计 ${est} 分钟`;

        const priorityLabel = { high: '🔴 重要', medium: '🟡 普通', low: '🟢 悠闲' };
        priorityBadge.textContent = priorityLabel[recommended.priority] || '普通';
        priorityBadge.className = `recommend-priority-badge ${recommended.priority}`;

        // 点击「马上开始」触发专注模式
        startBtn.onclick = () => {
            this.showFocusModal(recommended.id);
        };

        // 高亮对应任务卡片
        document.querySelectorAll('.task-item').forEach(el => el.classList.remove('is-recommended'));
        const card = document.querySelector(`.task-item[data-id="${recommended.id}"]`);
        if (card) card.classList.add('is-recommended');
    }

    // 检查连击系统（30分钟内完成2+个任务）
    checkComboSystem() {
        const now = Date.now();
        const windowMs = 30 * 60 * 1000; // 30分钟窗口

        // 清理超出窗口的记录
        this.recentCompletions = this.recentCompletions.filter(t => now - t < windowMs);
        this.recentCompletions.push(now);

        const count = this.recentCompletions.length;
        if (count >= 2) {
            this.comboCount = count;
            this.showComboToast(count);
        }
    }

    // 显示连击 Toast
    showComboToast(count) {
        const toast = document.getElementById('comboToast');
        const emojiEl = document.getElementById('comboEmoji');
        const textEl = document.getElementById('comboText');
        if (!toast) return;

        const combos = [
            { emoji: '🔥', text: `连击 x${count}！太猛了！` },
            { emoji: '⚡', text: `连击 x${count}！势如破竹！` },
            { emoji: '🚀', text: `连击 x${count}！效率爆棚！` },
            { emoji: '💥', text: `连击 x${count}！无法阻挡！` },
            { emoji: '🌟', text: `连击 x${count}！天才！` },
        ];
        const c = combos[Math.min(count - 2, combos.length - 1)];
        emojiEl.textContent = c.emoji;
        textEl.textContent = c.text;

        toast.style.display = 'block';
        // 触发动画
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        clearTimeout(this._comboTimer);
        this._comboTimer = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => { toast.style.display = 'none'; }, 400);
        }, 2800);
    }

    // 格式化日期时间
    formatDateTime(date, time) {
        const dateObj = new Date(date);
        const dateStr = dateObj.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        const weekDay = dateObj.toLocaleDateString('zh-CN', { weekday: 'short' });
        const today = new Date();
        
        let dateDisplay = '';
        if (dateObj.toDateString() === today.toDateString()) {
            dateDisplay = '今天';
        } else if (dateObj.toDateString() === new Date(today.getTime() + 24*60*60*1000).toDateString()) {
            dateDisplay = '明天';
        } else {
            dateDisplay = `${dateStr} ${weekDay}`;
        }
        
        return time ? `${dateDisplay} ${time}` : dateDisplay;
    }

    // 显示通知（可爱版）
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const icon = notification.querySelector('.notification-icon');
        const text = notification.querySelector('.notification-text');

        // 超级可爱的图标
        const icons = {
            success: '🎉',
            error: '😢',
            warning: '⚠️',
            info: '💡'
        };

        icon.textContent = icons[type];
        text.textContent = message;

        notification.className = 'notification show ' + type;

        // 成功时触发可爱效果
        if (type === 'success') {
            this.triggerCelebration();
        }

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // 触发可爱庆祝效果
    triggerCelebration() {
        const emojis = ['🌟', '✨', '💖', '🎀', '🌸', '🎈', '🎁', '💝'];

        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const emoji = document.createElement('div');
                emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                emoji.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    font-size: 30px;
                    pointer-events: none;
                    z-index: 9999;
                    animation: celebrate 1s ease-out forwards;
                    --tx: ${(Math.random() - 0.5) * 300}px;
                    --ty: ${(Math.random() - 0.5) * 300 - 200}px;
                    --r: ${Math.random() * 720}deg;
                `;
                document.body.appendChild(emoji);

                setTimeout(() => emoji.remove(), 1000);
            }, i * 50);
        }
    }

    // 关闭模态框
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        this.currentEditingTask = null;
        
        // 如果是停止专注,清除计时器（不要在这里清除focusingTask，stopFocus还需要用它）
        if (modalId === 'focusRunningModal' && this.focusTimer) {
            clearInterval(this.focusTimer);
            this.focusTimer = null;
        }
        
        // 只有非专注弹窗关闭时才清除focusingTask
        if (modalId !== 'focusModal' && modalId !== 'focusRunningModal') {
            this.focusingTask = null;
        }
    }

    // 触发撒花动画
    triggerConfetti() {
        const confetti = document.getElementById('confetti');
        confetti.innerHTML = '';
        
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
        
        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.top = '-10px';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.appendChild(piece);
        }
        
        setTimeout(() => {
            confetti.innerHTML = '';
        }, 4000);
    }

    // 保存任务
    saveTasks() {
        localStorage.setItem('cuteTasks', JSON.stringify(this.tasks));
    }

    // 保存用户数据
    saveUserData() {
        localStorage.setItem('cuteUserData', JSON.stringify(this.userData));
        // 自动触发云端同步（延迟执行，防止死循环）
        if (this.cloudSyncManager && !this._isMergingCloud) {
            clearTimeout(this._syncDebounceTimer);
            this._syncDebounceTimer = setTimeout(() => {
                this.cloudSyncManager.syncToCloud();
            }, 2000);
        }
    }

    // HTML转义
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 云端同步管理器
    initCloudSync() {
        this.cloudSyncManager = new CloudSyncManager(this);
        this.cloudSyncManager.init();
    }
}

// 云端同步管理器 - 使用Gitee
class CloudSyncManager {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.token = localStorage.getItem('giteeToken');
        this.repoOwner = localStorage.getItem('giteeOwner');
        this.repoName = 'cute-tasks-backup';
        this.filePath = 'tasks.json';
        this.username = localStorage.getItem('giteeUsername');
        this.autoSyncInterval = null;
        this.branch = 'master';
    }

    init() {
        this.updateUI();
        this.bindEvents();

        // 如果已登录,立即同步一次,然后启动自动同步
        if (this.token) {
            // 先从云端同步数据,再启动自动上传
            this.syncFromCloud().then(() => {
                this.startAutoSync();
            }).catch(() => {
                // 如果首次同步失败(云端没有数据),仍然启动自动同步
                this.startAutoSync();
            });
        }
    }

    bindEvents() {
        // Gitee登录
        document.getElementById('giteeLoginBtn').addEventListener('click', () => {
            this.showLoginModal();
        });

        // 立即同步
        document.getElementById('syncNowBtn').addEventListener('click', () => {
            this.syncToCloud();
        });

        // 退出登录
        document.getElementById('syncLogoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });
    }

    // 显示登录模态框
    showLoginModal() {
        // 检查是否已经有模态框
        const existingModal = document.querySelector('.gitee-login-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content gitee-login-modal">
                <div class="modal-header">
                    <h2>🐧 Gitee 登录</h2>
                    <span class="close-btn">&times;</span>
                </div>
                <div class="modal-body">
                    <p class="login-tip">请输入你的 Gitee 访问令牌</p>
                    <div class="form-group">
                        <label>访问令牌 (Personal Access Token)</label>
                        <input type="password" id="giteeTokenInput" placeholder="gitee_xxxxxxxxxxxx" value="a00af272eb277e9e3c980d45c321e6be">
                    </div>
                    <div class="form-group">
                        <label>Gitee 用户名</label>
                        <input type="text" id="giteeUsernameInput" placeholder="你的用户名" value="kuangquanshui73">
                    </div>
                    <div class="help-section">
                        <p class="help-title">如何获取访问令牌?</p>
                        <ol class="help-steps">
                            <li>访问 <a href="https://gitee.com/profile/personal_access_tokens" target="_blank">Gitee 个人令牌页面</a></li>
                            <li>点击"生成新令牌"</li>
                            <li>勾选权限: repositories, user_info</li>
                            <li>提交并复制令牌</li>
                        </ol>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary close-btn">取消</button>
                    <button class="btn btn-primary" id="confirmGiteeLogin">登录</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 绑定事件 - 使用更强的选择器
        const closeBtns = modal.querySelectorAll('.close-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.remove();
            });
        });

        const confirmBtn = modal.querySelector('#confirmGiteeLogin');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const token = document.getElementById('giteeTokenInput').value.trim();
                const username = document.getElementById('giteeUsernameInput').value.trim();

                if (token && username) {
                    this.handleLogin(token, username);
                    modal.remove();
                } else {
                    this.taskManager.showNotification('❌ 请填写完整信息!', 'error');
                }
            });
        }

        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 处理登录
    async handleLogin(token, username) {
        try {
            this.token = token;
            this.username = username;
            
            // 验证token是否有效
            const isValid = await this.validateToken();
            
            if (isValid) {
                // 保存到本地存储
                localStorage.setItem('giteeToken', this.token);
                localStorage.setItem('giteeUsername', this.username);
                localStorage.setItem('giteeOwner', this.username); // 修复：保存仓库所有者
                
                // 创建或获取仓库
                await this.createOrGetRepo();
                
                // 同步数据
                await this.syncFromCloud();
                
                this.updateUI();
                this.taskManager.showNotification('✅ 登录成功,数据已同步到云端!', 'success');
                this.startAutoSync();
            } else {
                this.taskManager.showNotification('❌ 令牌无效,请检查后重试!', 'error');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.taskManager.showNotification('❌ 登录失败,请重试!', 'error');
        }
    }

    // 验证token
    async validateToken() {
        try {
            const response = await fetch('https://gitee.com/api/v5/user', {
                headers: {
                    'Authorization': `token ${this.token}`,
                },
            });

            if (response.ok) {
                const user = await response.json();
                if (user.login) {
                    this.repoOwner = user.login;
                    localStorage.setItem('giteeOwner', this.repoOwner);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('验证token失败:', error);
            return false;
        }
    }

    // 创建或获取仓库
    async createOrGetRepo() {
        try {
            // 检查仓库是否存在
            const checkResponse = await fetch(
                `https://gitee.com/api/v5/repos/${this.repoOwner}/${this.repoName}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                    },
                }
            );

            if (checkResponse.ok) {
                // 仓库已存在,同步数据
                await this.syncFromCloud();
                return;
            }

            // 创建新仓库
            const createResponse = await fetch('https://gitee.com/api/v5/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: this.repoName,
                    description: '小可爱任务本数据备份',
                    private: true,
                    auto_init: false,
                }),
            });

            if (createResponse.ok) {
                // 创建初始文件
                await this.createInitialFile();
            }
        } catch (error) {
            console.error('创建仓库失败:', error);
        }
    }

    // 创建初始文件
    async createInitialFile() {
        try {
            // 使用 POST 创建新文件
            await fetch(`https://gitee.com/api/v5/repos/${this.repoOwner}/${this.repoName}/contents/${this.filePath}`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: this.getDataString(),
                    message: '初始化任务本数据',
                    branch: this.branch
                }),
            });

            this.updateLastSyncTime();
        } catch (error) {
            console.error('创建文件失败:', error);
        }
    }

    // 同步到云端
    async syncToCloud() {
        if (!this.token || !this.repoOwner) {
            this.taskManager.showNotification('❌ 请先登录 Gitee 云同步!', 'error');
            return;
        }

        try {
            // 先获取文件的SHA（如果文件存在）
            const getResponse = await fetch(
                `https://gitee.com/api/v5/repos/${this.repoOwner}/${this.repoName}/contents/${this.filePath}?ref=${this.branch}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                    },
                }
            );

            let sha = null;
            if (getResponse.ok) {
                const fileInfo = await getResponse.json();
                // 处理数组或对象的情况
                if (Array.isArray(fileInfo)) {
                    if (fileInfo.length > 0 && fileInfo[0].sha) {
                        sha = fileInfo[0].sha;
                    }
                } else if (fileInfo.sha) {
                    sha = fileInfo.sha;
                }
            }

            const content = this.getDataString();
            const message = `更新任务数据 - ${new Date().toLocaleString('zh-CN')}`;

            // Gitee API: 创建新文件用 POST，更新文件用 PUT
            const method = sha ? 'PUT' : 'POST';
            const body = {
                content: btoa(unescape(encodeURIComponent(content))),
                message: message,
                branch: this.branch
            };
            if (sha) {
                body.sha = sha;
            }

            const putResponse = await fetch(
                `https://gitee.com/api/v5/repos/${this.repoOwner}/${this.repoName}/contents/${this.filePath}`,
                {
                    method: method,
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                }
            );

            if (!putResponse.ok) {
                const errorData = await putResponse.json();
                console.error('同步失败:', errorData);
                this.taskManager.showNotification('❌ 同步失败: ' + (errorData.message || '未知错误'), 'error');
                return;
            }

            this.updateLastSyncTime();
            console.log('云端同步成功');
            this.taskManager.showNotification('✅ 数据已同步到云端!', 'success');
        } catch (error) {
            console.error('同步失败:', error);
            this.taskManager.showNotification('❌ 同步失败，请重试!', 'error');
        }
    }

    // 从云端同步
    async syncFromCloud() {
        if (!this.token || !this.repoOwner) {
            this.taskManager.showNotification('❌ 请先登录 Gitee 云同步!', 'error');
            return;
        }

        try {
            const response = await fetch(
                `https://gitee.com/api/v5/repos/${this.repoOwner}/${this.repoName}/contents/${this.filePath}?ref=${this.branch}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                    },
                }
            );

            if (!response.ok) {
                this.taskManager.showNotification('❌ 云端没有数据，首次请先在另一设备上传!', 'info');
                console.error('获取云端数据失败');
                return;
            }

            const fileInfo = await response.json();

            // 处理数组或对象的情况
            let contentStr = null;
            if (Array.isArray(fileInfo)) {
                if (fileInfo.length > 0 && fileInfo[0].content) {
                    contentStr = decodeURIComponent(escape(atob(fileInfo[0].content)));
                }
            } else if (fileInfo.content) {
                contentStr = decodeURIComponent(escape(atob(fileInfo.content)));
            }

            if (!contentStr) {
                this.taskManager.showNotification('❌ 云端数据格式错误!', 'error');
                return;
            }

            const data = JSON.parse(contentStr);

            // 合并云端数据
            this.mergeCloudData(data);
            this.updateLastSyncTime();
            this.taskManager.showNotification('✅ 数据已从云端同步!', 'success');
        } catch (error) {
            console.error('从云端同步失败:', error);
            this.taskManager.showNotification('❌ 同步失败，请重试!', 'error');
        }
    }

    // 合并云端数据
    mergeCloudData(cloudData) {
        // 设置标志位防止saveUserData触发新的云同步（避免死循环）
        this.taskManager._isMergingCloud = true;

        try {
            // 创建本地任务映射,方便快速查找
            const existingMap = new Map(
                this.taskManager.tasks.map(t => [t.id, t])
            );

            // 合并任务:根据最后修改时间决定使用哪个版本
            cloudData.tasks.forEach(cloudTask => {
                const localTask = existingMap.get(cloudTask.id);

                if (!localTask) {
                    // 新任务,直接添加
                    this.taskManager.tasks.push(cloudTask);
                } else {
                    // 任务已存在,需要决定使用哪个版本
                    const cloudModified = new Date(cloudTask.lastModified || cloudTask.completedAt || cloudTask.createdAt || 0);
                    const localModified = new Date(localTask.lastModified || localTask.completedAt || localTask.createdAt || 0);

                    if (cloudModified > localModified) {
                        // 云端版本更新,使用云端版本
                        const index = this.taskManager.tasks.findIndex(t => t.id === cloudTask.id);
                        if (index !== -1) {
                            this.taskManager.tasks[index] = cloudTask;
                        }
                    }
                    // 如果本地版本更新,保留本地版本
                }
            });

            this.taskManager.saveTasks();

            // 合并用户数据
            if (cloudData.userData) {
                this.taskManager.userData.totalStars = Math.max(
                    this.taskManager.userData.totalStars,
                    cloudData.userData.totalStars || 0
                );
                this.taskManager.userData.streakDays = Math.max(
                    this.taskManager.userData.streakDays,
                    cloudData.userData.streakDays || 0
                );
                this.taskManager.userData.totalCompleted = Math.max(
                    this.taskManager.userData.totalCompleted,
                    cloudData.userData.totalCompleted || 0
                );
                this.taskManager.totalFocusTime = Math.max(
                    this.taskManager.userData.totalFocusTime || 0,
                    cloudData.userData.totalFocusTime || 0
                );
                this.taskManager.saveUserData();
            }
        } catch (error) {
            console.error('合并数据时出错:', error);
        } finally {
            // 解除标志位
            this.taskManager._isMergingCloud = false;
        }

        // 更新界面
        this.taskManager.renderTasks();
        this.taskManager.updateStats();
    }

    // 获取数据字符串
    getDataString() {
        const data = {
            tasks: this.taskManager.tasks,
            userData: this.taskManager.userData,
            lastUpdated: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }

    // 启动自动同步
    startAutoSync() {
        // 每5分钟自动同步(先下载再上传)
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }
        this.autoSyncInterval = setInterval(async () => {
            try {
                // 先从云端获取最新数据
                await this.syncFromCloud();
                // 再上传本地数据
                await this.syncToCloud();
            } catch (error) {
                console.error('自动同步失败:', error);
            }
        }, 5 * 60 * 1000);

        // 页面关闭前同步
        window.addEventListener('beforeunload', () => {
            this.syncToCloud();
        });
    }

    // 停止自动同步
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    }

    // 更新UI
    updateUI() {
        const notLoggedIn = document.getElementById('syncNotLoggedIn');
        const loggedIn = document.getElementById('syncLoggedIn');
        
        if (this.token) {
            notLoggedIn.classList.add('hidden');
            loggedIn.classList.remove('hidden');
            document.getElementById('syncUsername').textContent = this.username;
            
            // 显示最后同步时间
            const lastSync = localStorage.getItem('lastSyncTime');
            if (lastSync) {
                const date = new Date(lastSync);
                document.getElementById('lastSyncTime').textContent = date.toLocaleString('zh-CN');
            }
        } else {
            notLoggedIn.classList.remove('hidden');
            loggedIn.classList.add('hidden');
        }
    }

    // 更新最后同步时间
    updateLastSyncTime() {
        const now = new Date().toISOString();
        localStorage.setItem('lastSyncTime', now);
        document.getElementById('lastSyncTime').textContent = new Date(now).toLocaleString('zh-CN');
    }

    // 退出登录
    handleLogout() {
        if (confirm('确定要退出登录吗?退出后数据将只保存在本地。')) {
            this.token = null;
            this.repoOwner = null;
            this.username = null;
            localStorage.removeItem('giteeToken');
            localStorage.removeItem('giteeOwner');
            localStorage.removeItem('giteeUsername');
            localStorage.removeItem('lastSyncTime');
            
            this.stopAutoSync();
            this.updateUI();
            this.taskManager.showNotification('已退出登录', 'info');
        }
    }

    // 初始化移动端导航
    initMobileNav() {
        // 检测是否为移动设备
        this.isMobile = window.innerWidth < 768;

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth < 768;
        });
    }

    // 切换移动端标签页
    switchMobileTab(tab) {
        // 更新导航栏状态
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.dataset.tab === tab) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 根据标签页显示不同内容
        switch (tab) {
            case 'today':
                this.renderTasks('today');
                break;
            case 'all':
                this.renderTasks('all');
                break;
            case 'rewards':
                this.scrollToSection('rewards');
                break;
            case 'settings':
                this.scrollToSection('settings');
                break;
        }
    }

    // 滚动到指定区域
    scrollToSection(sectionId) {
        const section = document.querySelector(`.${sectionId}-shop, .settings-section`);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 显示添加任务表单（移动端）
    showAddTaskForm() {
        const addSection = document.querySelector('.quick-add');
        if (addSection) {
            addSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // 聚焦输入框
            setTimeout(() => {
                const input = document.getElementById('taskTitle');
                if (input) {
                    input.focus();
                }
            }, 300);
        }
    }

    // ===== 新增：页面切换 =====
    switchPage(page) {
        // 隐藏所有页面
        const pages = document.querySelectorAll('.page');
        pages.forEach(p => p.classList.remove('active'));

        // 显示目标页面
        const targetPage = document.getElementById('page-' + page);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // 更新导航栏状态
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.dataset.page === page) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 根据页面执行不同操作
        switch(page) {
            case 'today':
                this.renderTasks('today');
                break;
            case 'all':
                this.renderTasks('all');
                break;
            case 'rewards':
                this.renderRewards();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    // ===== 新增：渲染奖励页面 =====
    renderRewards() {
        const rewards = [
            { icon: '🎮', title: '游戏时间 1小时', cost: 30, desc: '完成今天的任务后，可以自由地玩游戏1小时！' },
            { icon: '🍦', title: '冰淇淋一支', cost: 20, desc: '奖励自己一支美味的冰淇淋！' },
            { icon: '📺', title: '追剧2小时', cost: 50, desc: '放松一下，追自己喜欢看的剧！' },
            { icon: '🛍️', title: '购物50元', cost: 100, desc: '买自己喜欢的东西！' },
            { icon: '✈️', title: '周末旅行', cost: 500, desc: '完成一个月的任务后，奖励自己一次周末旅行！' }
        ];

        const points = this.calculateTotalPoints();
        const container = document.querySelector('#page-rewards section') || this.createRewardsContainer();

        container.innerHTML = rewards.map(reward => {
            const canClaim = points >= reward.cost;
            return `
                <div class="reward-card ${canClaim ? '' : 'locked'}">
                    <div class="reward-header">
                        <span class="reward-icon">${reward.icon}</span>
                        <div>
                            <div class="reward-title">${reward.title}</div>
                            <div class="reward-cost">⭐ ${reward.cost}</div>
                        </div>
                    </div>
                    <p class="reward-desc">${reward.desc}</p>
                    ${canClaim ? `<button class="claim-btn" onclick="claimReward('${reward.title}', ${reward.cost})">领取奖励 🎁</button>` : ''}
                </div>
            `;
        }).join('');
    }

    createRewardsContainer() {
        const container = document.createElement('section');
        container.innerHTML = '<div class="rewards-list"></div>';
        document.getElementById('page-rewards').appendChild(container);
        return container;
    }

    // ===== 新增：计算总积分 =====
    calculateTotalPoints() {
        return this.tasks.reduce((total, task) => {
            if (task.completed) {
                return total + (task.priority === 'high' ? 10 : task.priority === 'medium' ? 5 : 3);
            }
            return total;
        }, 0);
    }

    // ===== 新增：渲染设置页面 =====
    renderSettings() {
        // 更新云同步状态
        const syncStatus = document.querySelector('.sync-status');
        if (syncStatus) {
            if (this.token) {
                syncStatus.classList.remove('disconnected');
                syncStatus.classList.add('connected');
                syncStatus.querySelector('.sync-status-text').innerHTML =
                    `<div>✅ 已连接到 Gitee</div><div style="font-size: 0.8em; opacity: 0.8;">上次同步：刚刚</div>`;
            } else {
                syncStatus.classList.remove('connected');
                syncStatus.classList.add('disconnected');
                syncStatus.querySelector('.sync-status-text').innerHTML =
                    `<div>❌ 未连接</div><div style="font-size: 0.8em; opacity: 0.8;">请先登录 Gitee</div>`;
            }
        }
    }

    // ===== 新增：领取奖励 =====
    claimReward(title, cost) {
        const points = this.calculateTotalPoints();
        if (points < cost) {
            this.showNotification('积分不足！需要 ' + cost + ' 分', 'error');
            return;
        }

        if (confirm(`确定要领取"${title}"吗？需要消耗 ${cost} 积分`)) {
            // 扣除积分（这里简化处理，实际应该记录已领取的奖励）
            this.triggerCelebration();
            this.showNotification(`🎁 成功领取：${title}`, 'success');
        }
    }

    // ===== 新增：增强的庆祝动画 =====
    triggerCelebration() {
        const emojis = ['🌟', '✨', '💖', '🎀', '🌸', '🎈', '🎁', '💝', '🎉', '🎊', '🌈', '⭐'];

        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const emoji = document.createElement('div');
                emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                emoji.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    font-size: ${25 + Math.random() * 20}px;
                    pointer-events: none;
                    z-index: 9999;
                    animation: celebrate 1.2s ease-out forwards;
                    --tx: ${(Math.random() - 0.5) * 400}px;
                    --ty: ${(Math.random() - 0.5) * 400 - 200}px;
                    --r: ${Math.random() * 720}deg;
                `;
                document.body.appendChild(emoji);

                setTimeout(() => emoji.remove(), 1200);
            }, i * 40);
        }
    }
}

// 全局函数：领取奖励
window.claimReward = function(title, cost) {
    if (window.taskManager) {
        window.taskManager.claimReward(title, cost);
    }
};

// 初始化
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new CuteTaskManager();
});
