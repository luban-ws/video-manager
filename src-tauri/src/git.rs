use git2::{Repository, Signature};
use std::path::Path;

// 初始化 Git 仓库
pub fn init_repo(repo_path: &Path) -> Result<Repository, String> {
    Repository::init(repo_path)
        .map_err(|e| format!("初始化 Git 仓库失败: {e}"))
}

// 打开现有仓库
pub fn open_repo(repo_path: &Path) -> Result<Repository, String> {
    Repository::open(repo_path)
        .map_err(|e| format!("打开 Git 仓库失败: {e}"))
}

// 获取或初始化仓库
pub fn get_or_init_repo(repo_path: &Path) -> Result<Repository, String> {
    match open_repo(repo_path) {
        Ok(repo) => Ok(repo),
        Err(_) => init_repo(repo_path),
    }
}

// 添加文件到暂存区
pub fn add_file(repo: &Repository, file_path: &Path) -> Result<(), String> {
    let mut index = repo.index()
        .map_err(|e| format!("获取索引失败: {e}"))?;

    let repo_path = repo.workdir()
        .ok_or("无法获取工作目录")?;

    let relative_path = file_path.strip_prefix(repo_path)
        .map_err(|e| format!("计算相对路径失败: {e}"))?;

    index.add_path(relative_path)
        .map_err(|e| format!("添加文件到索引失败: {e}"))?;

    index.write()
        .map_err(|e| format!("写入索引失败: {e}"))?;

    Ok(())
}

// 提交更改
pub fn commit(
    repo: &Repository,
    message: &str,
    author_name: &str,
    author_email: &str,
) -> Result<String, String> {
    let signature = Signature::now(author_name, author_email)
        .map_err(|e| format!("创建签名失败: {e}"))?;

    let tree_id = {
        let mut index = repo.index()
            .map_err(|e| format!("获取索引失败: {e}"))?;
        index.write_tree()
            .map_err(|e| format!("写入树失败: {e}"))?
    };

    let tree = repo.find_tree(tree_id)
        .map_err(|e| format!("查找树失败: {e}"))?;

    let head = repo.head();
    let parent_commit = if let Ok(head) = head {
        Some(head.peel_to_commit()
            .map_err(|e| format!("获取提交失败: {e}"))?)
    } else {
        None
    };

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    let commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &parents,
    )
    .map_err(|e| format!("提交失败: {e}"))?;

    Ok(commit_id.to_string())
}

// 获取仓库状态
pub fn get_status(repo: &Repository) -> Result<Vec<String>, String> {
    let mut status_options = git2::StatusOptions::new();
    status_options.include_untracked(true);
    status_options.include_ignored(false);

    let statuses = repo.statuses(Some(&mut status_options))
        .map_err(|e| format!("获取状态失败: {e}"))?;

    let mut result = Vec::new();
    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            result.push(path.to_string());
        }
    }

    Ok(result)
}

// 获取提交历史
pub fn get_commit_history(repo: &Repository, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("创建 revwalk 失败: {e}"))?;

    revwalk.push_head()
        .map_err(|e| format!("推送 HEAD 失败: {e}"))?;

    let mut commits = Vec::new();
    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }

        let oid = oid.map_err(|e| format!("获取 OID 失败: {e}"))?;
        let commit = repo.find_commit(oid)
            .map_err(|e| format!("查找提交失败: {e}"))?;

        commits.push(CommitInfo {
            id: oid.to_string(),
            message: commit.message()
                .map(|m| m.to_string())
                .unwrap_or_else(|| "".to_string()),
            author: commit.author().name().unwrap_or("").to_string(),
            time: commit.time().seconds(),
        });
    }

    Ok(commits)
}

#[derive(Debug, serde::Serialize)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub author: String,
    pub time: i64,
}
