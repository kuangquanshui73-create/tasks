// 自动化同步脚本 - 直接在控制台运行
(async function autoSync() {
    console.log('🚀 开始自动同步测试...\n');

    try {
        // 1. 检查登录状态
        console.log('1. 检查登录状态...');
        const token = localStorage.getItem('giteeToken');
        const username = localStorage.getItem('giteeUsername');

        if (!token || !username) {
            console.log('   未登录，正在自动登录...');
            localStorage.setItem('giteeToken', 'a00af272eb277e9e3c980d45c321e6be');
            localStorage.setItem('giteeUsername', 'kuangquanshui73');
            localStorage.setItem('giteeOwner', 'kuangquanshui73');
            console.log('   ✅ 登录信息已保存');
        } else {
            console.log('   ✅ 已登录:', username);
        }

        // 2. 验证 Token
        console.log('\n2. 验证 Token...');
        const response = await fetch('https://gitee.com/api/v5/user', {
            headers: { 'Authorization': `token ${localStorage.getItem('giteeToken')}` }
        });
        const user = await response.json();

        if (response.ok && user.login) {
            console.log('   ✅ Token 有效，用户名:', user.login);
            localStorage.setItem('giteeOwner', user.login);
        } else {
            console.log('   ❌ Token 无效');
            return;
        }

        // 3. 检查仓库
        console.log('\n3. 检查仓库...');
        const repoResponse = await fetch(
            `https://gitee.com/api/v5/repos/${user.login}/cute-tasks-backup`,
            { headers: { 'Authorization': `token ${localStorage.getItem('giteeToken')}` } }
        );

        if (repoResponse.ok) {
            const repo = await repoResponse.json();
            console.log('   ✅ 仓库存在，公开状态:', repo.public ? '公开' : '私有');
        } else {
            console.log('   ❌ 仓库不存在');
            return;
        }

        // 4. 准备同步数据
        console.log('\n4. 准备同步数据...');
        const tasks = JSON.parse(localStorage.getItem('cuteTasks')) || [];
        const userData = JSON.parse(localStorage.getItem('cuteUserData')) || {
            totalCompleted: 0,
            streakDays: 0,
            totalStars: 0,
            lastActiveDate: null,
            rewards: [],
            totalFocusTime: 0
        };

        const syncData = {
            tasks: tasks,
            userData: userData,
            lastUpdated: new Date().toISOString()
        };

        console.log('   任务数量:', tasks.length);
        console.log('   总星星:', userData.totalStars);

        // 5. 同步到云端
        console.log('\n5. 同步到云端...');

        // 先获取文件的 SHA
        const getFileResponse = await fetch(
            `https://gitee.com/api/v5/repos/${user.login}/cute-tasks-backup/contents/tasks.json`,
            { headers: { 'Authorization': `token ${localStorage.getItem('giteeToken')}` } }
        );

        let sha = null;
        if (getFileResponse.ok) {
            const fileInfo = await getFileResponse.json();
            sha = fileInfo.sha;
            console.log('   文件已存在，准备更新');
        } else {
            console.log('   文件不存在，准备创建');
        }

        // 上传文件
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(syncData, null, 2))));
        const body = {
            content: content,
            message: `更新任务数据 - ${new Date().toLocaleString('zh-CN')}`
        };
        if (sha) body.sha = sha;

        const uploadResponse = await fetch(
            `https://gitee.com/api/v5/repos/${user.login}/cute-tasks-backup/contents/tasks.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${localStorage.getItem('giteeToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        if (uploadResponse.ok) {
            console.log('   ✅ 同步成功！');
            localStorage.setItem('lastSyncTime', new Date().toISOString());
        } else {
            const error = await uploadResponse.json();
            console.log('   ❌ 同步失败:', error.message);
        }

        // 6. 验证同步
        console.log('\n6. 验证同步...');
        const verifyResponse = await fetch(
            `https://gitee.com/api/v5/repos/${user.login}/cute-tasks-backup/contents/tasks.json`,
            { headers: { 'Authorization': `token ${localStorage.getItem('giteeToken')}` } }
        );

        if (verifyResponse.ok) {
            const fileInfo = await verifyResponse.json();
            console.log('   ✅ 云端文件已更新');
            console.log('   文件大小:', fileInfo.size, '字节');
            console.log('   更新时间:', new Date(fileInfo.updated_at).toLocaleString('zh-CN'));
        }

        console.log('\n✅ 同步测试完成！');
        console.log('\n📱 现在你可以在手机上打开：');
        console.log('   https://kuangquanshui73-create.github.io/tasks');
        console.log('   登录后点击"立即同步"即可看到数据！');

    } catch (error) {
        console.log('\n❌ 错误:', error.message);
        console.log(error.stack);
    }
})();
