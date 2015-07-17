import Debug from 'debug';
import fs from 'mz/fs';
import path from 'path';
import Promise from 'promise';
import slugid from 'slugid';
import uploadToS3 from '../upload_to_s3';
import waitForEvent from '../wait_for_event';
import zlib from 'zlib';

let debug = Debug('docker-worker:features:docker-save');

const ARTIFACT_NAME = 'private/dockerImage.tar'

export default class DockerSave {
  async killed (task) {
    //temporary path for saved file
    let pathname = path.join('/tmp', slugid.v4() + '.tar.gz');

    try {
      let {Id: imageId} = await task.dockerProcess.container.commit({
        repo: 'task/' + task.status.taskId + '/' + task.runId
      });
      let image = task.runtime.docker.getImage('task/' + task.status.taskId + '/' + task.runId + ':latest');
      let imgStream = await image.get();
      let zipStream = zlib.createGzip();
      imgStream.pipe(zipStream).pipe(fs.createWriteStream(pathname));
      await waitForEvent(zipStream, 'end');
      debug('tar written');

      let stat = await fs.stat(pathname);
      debug(stat.size);
      let uploadStream = fs.createReadStream(pathname);
    } catch (e) {
      throw new Error('could not get saved image from docker' + task.status.taskId);
    }

    try {
      await uploadToS3(task, uploadStream, ARTIFACT_NAME, 60 * 1000, {
        'content-type': 'application/x-tar',
        'content-length': stat.size,
        'content-encoding': 'gzip'
      });
    } catch (e) {
      throw new Error('could not upload saved image to s3' + task.status.taskId);
    }

    debug('artifact uploaded');

    //cleanup
    fs.unlink(pathname).catch(() => {
      task.runtime.log('[alert-operator] could not delete docker save tarball, worker may run out of hdd space');
    });
    await image.remove();
  }
}
 