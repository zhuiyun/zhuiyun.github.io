---
layout: post
title: AsyncTask源码分析
date: 2019.7.19
body: [article,  comments]
toc: true
tag: [Android,源码]
categories: [Android]
---

先看一下用法

        AsyncTask<Void, Void, Void> asyncTask = new AsyncTask<Void, Void, Void>() {

            @Override
            protected Void doInBackground(Void... voids) {
                return null;
            }
        };
        asyncTask.execute();
源码中这是一个抽象类,必须自己去实现,才能使用
<!-- more -->

```
public abstract class AsyncTask<Params, Progress, Result>

```

有三个参数,第一个是你要传什么东西异步使用,一般可能是网址,不需要传可以填void,第二个参数为执行进度,不需要也可以填void,第三个是返回数据,也可以填void.

用asyncTask.execute()执行AsyncTask,括号中填的跟第一个参数对应. excute()方法调用了这个方法,还是在主线程中

    @MainThread
    public final AsyncTask<Params, Progress, Result> execute(Params... params) {
        return executeOnExecutor(sDefaultExecutor, params);
    }
之后调用

    @MainThread
    public final AsyncTask<Params, Progress, Result> executeOnExecutor(Executor exec,
            Params... params) {
        if (mStatus != Status.PENDING) {
            switch (mStatus) {
                case RUNNING:
                    throw new IllegalStateException("Cannot execute task:"
                            + " the task is already running.");
                case FINISHED:
                    throw new IllegalStateException("Cannot execute task:"
                            + " the task has already been executed "
                            + "(a task can be executed only once)");
            }
        }

        mStatus = Status.RUNNING;

        onPreExecute();

        mWorker.mParams = params;
        exec.execute(mFuture);

        return this;
    }
这个方法中判断了mStatus的状态,里面有两个异常抛出,可以看出一个任务只能执行一次. 而mStatus在初始化时置为了Status.PENDING,所以不会进入if (mStatus != Status.PENDING),会改变mStatus状态:mStatus = Status.RUNNING;

private volatile Status mStatus = Status.PENDING;
接下来调用onPreExecute(),点进去看一下这个方法.

    @MainThread
    protected void onPreExecute() {
    }
这方法是空实现,注解表示此时仍在主线程中,之后调用

```
exec.execute(mFuture);
void execute(Runnable command);
```

exec是之前的sDefaultExecutor

```
private static volatile Executor sDefaultExecutor = SERIAL_EXECUTOR;

public static final Executor SERIAL_EXECUTOR = new SerialExecutor();


private static class SerialExecutor implements Executor {
        final ArrayDeque<Runnable> mTasks = new ArrayDeque<Runnable>();
        Runnable mActive;
```

        public synchronized void execute(final Runnable r) {
            mTasks.offer(new Runnable() {
                public void run() {
                    try {
                        r.run();
                    } finally {
                        scheduleNext();
                    }
                }
            });
            if (mActive == null) {
                scheduleNext();
            }
        }

        protected synchronized void scheduleNext() {
            if ((mActive = mTasks.poll()) != null) {
                THREAD_POOL_EXECUTOR.execute(mActive);
            }
        }
    }
scheduleNext()在这个方法中,由线程池来执行任务

```
protected synchronized void scheduleNext() {
            if ((mActive = mTasks.poll()) != null) {
                THREAD_POOL_EXECUTOR.execute(mActive);
            }
        }
        

public E poll() {
        return pollFirst();
    }

```
 也就是会调出第一个任务来执行

execute方法 需要一个Runnable,最终调用Runnable的run方法,也就是mFuture的run方法


```
public void run() {
        if (state != NEW ||
            !U.compareAndSwapObject(this, RUNNER, null, Thread.currentThread()))
            return;
        try {
            Callable<V> c = callable;
            if (c != null && state == NEW) {
                V result;
                boolean ran;
                try {
                    result = c.call();
                    ran = true;
                } catch (Throwable ex) {
                    result = null;
                    ran = false;
                    setException(ex);
                }
                if (ran)
                    set(result);
            }
        } finally {
            // runner must be non-null until state is settled to
            // prevent concurrent calls to run()
            runner = null;
            // state must be re-read after nulling runner to prevent
            // leaked interrupts
            int s = state;
            if (s >= INTERRUPTING)
                handlePossibleCancellationInterrupt(s);
        }
    }

```
并调用了c.call()方法,而mFuture初始化时传入了一个callable,也就是调用的这个callable的call方法


```
public FutureTask(Callable<V> callable) {
        if (callable == null)
            throw new NullPointerException();
        this.callable = callable;
        this.state = NEW;       // ensure visibility of callable
    }

```
mFuture在初始化时传进去一个mWorker,也就是一个Callable


```
mWorker = new WorkerRunnable<Params, Result>() {
            public Result call() throws Exception {
                mTaskInvoked.set(true);
                Result result = null;
                try {
                    Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND);
                    //noinspection unchecked
                    result = doInBackground(mParams);
                    Binder.flushPendingCommands();
                } catch (Throwable tr) {
                    mCancelled.set(true);
                    throw tr;
                } finally {
                    postResult(result);
                }
                return result;
            }
        };

```
在这里执行了doInBackground(mParams),且是异步执行,在finally中调用了 postResult(result),publishProgress需要手动调用才会执行.

postResult(result)方法是在异步调用,但方法里的实现使用Handler发送消息到主线程

    private Result postResult(Result result) {
        @SuppressWarnings("unchecked")
        Message message = getHandler().obtainMessage(MESSAGE_POST_RESULT,
                new AsyncTaskResult<Result>(this, result));
        message.sendToTarget();
        return result;
    }

```
private static class InternalHandler extends Handler {
        public InternalHandler(Looper looper) {
            super(looper);
        }

```
        @SuppressWarnings({"unchecked", "RawUseOfParameterizedType"})
        @Override
        public void handleMessage(Message msg) {
            AsyncTaskResult<?> result = (AsyncTaskResult<?>) msg.obj;
            switch (msg.what) {
                case MESSAGE_POST_RESULT:
                    // There is only one result
                    result.mTask.finish(result.mData[0]);
                    break;
                case MESSAGE_POST_PROGRESS:
                    result.mTask.onProgressUpdate(result.mData);
                    break;
            }
        }
    }
最终在主线程中回调了publishProgress和onPostExecute(result)

 
```
@WorkerThread
    protected final void publishProgress(Progress... values) {
        if (!isCancelled()) {
            getHandler().obtainMessage(MESSAGE_POST_PROGRESS,
                    new AsyncTaskResult<Progress>(this, values)).sendToTarget();
        }
    }

```
    private void finish(Result result) {
        if (isCancelled()) {
            onCancelled(result);
        } else {
            onPostExecute(result);
        }
        mStatus = Status.FINISHED;
    }




