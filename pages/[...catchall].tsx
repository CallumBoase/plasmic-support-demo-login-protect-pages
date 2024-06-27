// ./pages/[...catchall].tsx

/* 
  Catchall page that runs for every page EXCEPT /, /login
  These pages are login protected
  
  The routes that render through this page are rendered on-demand (getServerSideProps instead of getStaticProps) 
  because they are login protected. This ensures that the user's session is checked on every request

  This pages is a modified various of the standard Plasmic NextJS loader API catchall page.

  Pages created in Plasmic studio will render using this catchall if it's:
    Page Settings -> URL path is not "/" or "/login"
*/

import type { GetServerSideProps } from "next";

import * as React from "react";
import {
  PlasmicComponent,
  extractPlasmicQueryData,
  ComponentRenderData,
  PlasmicRootProvider,
} from "@plasmicapp/loader-nextjs";

import Error from "next/error";
import { useRouter } from "next/router";
import { PLASMIC } from "@/plasmic-init";

export default function PlasmicLoaderPage(props: {
  plasmicData?: ComponentRenderData;
  queryCache?: Record<string, any>;
}) {
  const { plasmicData, queryCache } = props;
  const router = useRouter();
  if (!plasmicData || plasmicData.entryCompMetas.length === 0) {
    return <Error statusCode={404} />;
  }
  const pageMeta = plasmicData.entryCompMetas[0];
  return (
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      prefetchedQueryData={queryCache}
      pageParams={pageMeta.params}
      pageQuery={router.query}
    >
      <PlasmicComponent component={pageMeta.displayName} />
    </PlasmicRootProvider>
  );
}

//This runs on the server while rendering
//Unlike the pages in the root directory, we run this every time the page is requested with no cache
//This is appropriate because these pages are login protected and only work with a valid session
//We also need to recheck each time the page is requested to ensure the user is still authenticated
export const getServerSideProps: GetServerSideProps = async (context) => {

  //Get the catchall parameter from the page context
  const { catchall } = context.params ?? {};

  //Get the path of the current page
  let plasmicPath = typeof catchall === 'string' ? catchall : Array.isArray(catchall) ? `/${catchall.join('/')}` : '/';

  // Here we would normally determine if the user is authorized to view this page with Supabase here
  // const supabase = createClient(context);
  // const { data: { user } } = await supabase.auth.getUser();
  // const isAuthorized = authorizationCheckFunction(plasmicPath, user);

  //However, for simplicity of this example repo, we hard-code authorized to true or false manually for easy testing
  const isAuthorized = true;

  if(isAuthorized !== true) return {
    redirect: {
      destination: '/login',
      permanent: false,
    }
  }

  //Fetch data for the current page/component from plasmic
  const plasmicData = await PLASMIC.maybeFetchComponentData(plasmicPath);
  
  //If there's no plasmic data, the page does not exist in plasmic. So return nothing
  //This will ultimately cause a 404 error to be shown by default
  if (!plasmicData) {
    // non-Plasmic catch-all
    return { props: {} };
  }
  //Get the metadata for the current page
  const pageMeta = plasmicData.entryCompMetas[0];
  //Prefetch any data for the page
  const queryCache = await extractPlasmicQueryData(
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      pageParams={pageMeta.params}
    >
      <PlasmicComponent component={pageMeta.displayName} />
    </PlasmicRootProvider>
  );
  //Return the plasmic data and the query cache data
  return { props: { plasmicData, queryCache } };
}
