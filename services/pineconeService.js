import {Pinecone} from '@pinecone-database/pinecone';

class PineconeService
{
    constructor()
    {
        this.apiKey=process.env.PINECONE_API_KEY;
        this.indexName=process.env.PINECONE_INDEX||'axiom-chat-memory';

        if (!this.apiKey)
        {
            console.warn('⚠️  PINECONE_API_KEY not found - Vector memory will not work');
            console.warn('   Get your free API key from https://www.pinecone.io/');
            this.initialized=false;
        } else
        {
            this.initializePinecone();
        }
    }

    async initializePinecone()
    {
        try
        {
            this.pinecone=new Pinecone({
                apiKey: this.apiKey,
            });

            // Check if index exists
            const indexList=await this.pinecone.listIndexes();
            const indexExists=indexList.indexes?.some(idx => idx.name===this.indexName);

            if (!indexExists)
            {
                console.warn('⚠️  Pinecone index not found:', this.indexName);
                console.warn('   Please create an index in your Pinecone dashboard:');
                console.warn('   1. Go to https://app.pinecone.io/');
                console.warn(`   2. Create an index named "${this.indexName}"`);
                console.warn('   3. Set dimension to 768 (for text-embedding-004)');
                console.warn('   4. Choose "cosine" as the metric');
                console.warn('   5. Select the free "Starter" plan');
                console.warn('   📝 Vector memory will not work until the index is created');
                this.initialized=false;
                return;
            }

            this.index=this.pinecone.index(this.indexName);
            this.initialized=true;
            console.log('✅ Pinecone initialized with index:', this.indexName);
        } catch (error)
        {
            console.error('Pinecone Initialization Error:', error.message);
            console.warn('   Make sure your PINECONE_API_KEY is correct');
            this.initialized=false;
        }
    }

    async createMemory(vector, metadata, id)
    {
        if (!this.initialized)
        {
            return null;
        }

        try
        {
            const vectorId=id||`msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await this.index.upsert([
                {
                    id: vectorId,
                    values: vector,
                    metadata: {
                        ...metadata,
                        timestamp: new Date().toISOString()
                    }
                }
            ]);

            return vectorId;
        } catch (error)
        {
            console.error('Pinecone Create Memory Error:', error.message);
            return null;
        }
    }

    async queryMemory(vector, topK=3, filter={})
    {
        if (!this.initialized)
        {
            return [];
        }

        try
        {
            const queryResponse=await this.index.query({
                vector,
                topK,
                filter,
                includeMetadata: true
            });

            return queryResponse.matches||[];
        } catch (error)
        {
            console.error('Pinecone Query Memory Error:', error.message);
            return [];
        }
    }

    async deleteMemory(id)
    {
        if (!this.initialized)
        {
            return false;
        }

        try
        {
            await this.index.deleteOne(id);
            return true;
        } catch (error)
        {
            console.error('Pinecone Delete Memory Error:', error.message);
            return false;
        }
    }

    async clearMemories(filter={})
    {
        if (!this.initialized)
        {
            return false;
        }

        try
        {
            await this.index.deleteMany(filter);
            return true;
        } catch (error)
        {
            console.error('Pinecone Clear Memories Error:', error.message);
            return false;
        }
    }
}

export default new PineconeService();
