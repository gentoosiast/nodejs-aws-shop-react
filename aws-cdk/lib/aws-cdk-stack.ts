import * as path from 'node:path';
import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { type Construct} from 'constructs';

const SITE_NAME = 'spa-shop-react';

export class StaticSiteStack extends Stack {
  constructor(parent: Construct, id: string, props?: StackProps) {
    super(parent, id, props);

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: `CloudFront OAI for ${SITE_NAME}`,
    });

    const s3Bucket = new s3.Bucket(this, SITE_NAME, {
      bucketName: `s3-${SITE_NAME}`,
      websiteIndexDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    s3Bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [s3Bucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
    }));

    const cloudfrontDist = new cloudfront.CloudFrontWebDistribution(this, `cfd-${SITE_NAME}`, {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: s3Bucket,
            originAccessIdentity: cloudfrontOAI,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              compress: true,
              allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
              viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            }
          ],
        }
      ],
    })

    new s3deploy.BucketDeployment(this, 'bucket-deployment', {
      sources: [s3deploy.Source.asset(path.resolve('.', '..', 'dist'))],
      destinationBucket: s3Bucket,
      distribution: cloudfrontDist,
      distributionPaths: ['/*'],
    });
  }
}